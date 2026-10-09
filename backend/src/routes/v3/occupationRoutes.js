import express from "express"
import { prisma } from "../../config/db.js"

const router = express.Router()

// ── Label helpers (same as it2) 
const getResilienceLabel = (score) => {
  if (score >= 70) return "High — AI is more likely to enhance this role"
  if (score >= 40) return "Medium — AI will change parts of this role"
  return "Low — AI may significantly automate this role"
}

const getTaskLabel = (score) => {
  if (score >= 0.67) return "High exposure"
  if (score >= 0.34) return "Moderate exposure"
  return "Low exposure"
}

const getMatchLabel = (score) => {
  if (score >= 80) return "Strong match"
  if (score >= 50) return "Good match"
  return "Possible match"
}

// ── GET /api/v3/occupations 
// Returns all occupations — optional ?category=ICT filter
router.get("/", async (req, res) => {
  try {
    const { category } = req.query
    const where = category ? { category } : {}

    const occupations = await prisma.occupations.findMany({
      where,
      select: {
        anzsco_code: true,
        name: true,
        category: true,
        interest_code: true,
      },
      orderBy: { name: "asc" },
    })

    res.json({ occupations })
  } catch (error) {
    console.error("GET /api/v3/occupations error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// ── POST /api/v3/occupations/match 

router.post("/match", async (req, res) => {
  try {
    const { interest_codes, skill_names, state } = req.body

    if (!Array.isArray(interest_codes) || interest_codes.length === 0) {
      return res.status(400).json({ error: "interest_codes must be a non-empty array of RIASEC letters" })
    }

    const uniqueCodes = [...new Set(interest_codes.map(c => c.toUpperCase().trim()))]
    const hasSkills = Array.isArray(skill_names) && skill_names.length > 0
    const hasRegion = !!state

    // Step 1 — Interest matching via occupation_interests
    // occupation_interests has (anzsco_code, position, interest_type) where interest_type is a single RIASEC letter
    const interestMatches = await prisma.occupation_interests.findMany({
      where: { interest_type: { in: uniqueCodes } },
      include: {
        occupations: {
          select: { anzsco_code: true, name: true, category: true, interest_code: true },
        },
      },
    })

    const scoreMap = {}
    for (const match of interestMatches) {
      const code = match.anzsco_code
      if (!scoreMap[code]) {
        scoreMap[code] = {
          occupation: match.occupations,
          interest_score: 0,
          skill_score: 0,
          regional_score: 0,
        }
      }
      scoreMap[code].interest_score += 1
    }

    if (Object.keys(scoreMap).length === 0) {
      return res.json([])
    }

    // Step 2 — Skill overlap scoring (optional)
    if (hasSkills) {
      const selectedLower = skill_names.map(s => s.toLowerCase().trim())
      for (const anzsco_code of Object.keys(scoreMap)) {
        const occSkills = await prisma.occupation_skills.findMany({
          where: { anzsco_code, position: { not: null } },
          include: { skills: { select: { name: true } } },
        })
        if (occSkills.length > 0) {
          const matched = occSkills.filter(os =>
            selectedLower.some(s => {
              const skillName = os.skills.name.toLowerCase().trim()
              return s === skillName || skillName.includes(s) || s.includes(skillName)
            })
          )
          scoreMap[anzsco_code].skill_score = matched.length / occSkills.length
        }
      }
    }

    // Step 3 — Regional demand scoring using it3 regional_vacancies table
    // Same logic as it2 but using new table — normalize by max vacancies across states
    if (hasRegion) {
      // Get latest month's vacancy total per state across all ANZSCO2 groups
      const latestVacancies = await prisma.regional_vacancies.findMany({
        orderBy: { month: "desc" },
        take: 2000,
        include: {
          regions: { select: { state: true } },
        },
      })

      // Get most recent vacancy per state (first occurrence = most recent due to orderBy desc)
      const latestByState = {}
      for (const row of latestVacancies) {
        const st = row.regions?.state
        if (!st) continue
        if (!latestByState[st]) latestByState[st] = 0
        latestByState[st] += parseFloat(row.vacancies_3m_avg)
      }

      // But deduplicate: only count the latest month per state
      // Re-do: group by state, take only rows from the single most recent month
      const latestMonth = latestVacancies[0]?.month?.toISOString().slice(0, 7)
      const latestMonthByState = {}
      for (const row of latestVacancies) {
        const rowMonth = row.month?.toISOString().slice(0, 7)
        if (rowMonth !== latestMonth) continue
        const st = row.regions?.state
        if (!st) continue
        if (!latestMonthByState[st]) latestMonthByState[st] = 0
        latestMonthByState[st] += parseFloat(row.vacancies_3m_avg)
      }

      const maxVacancy = Math.max(...Object.values(latestMonthByState), 1)
      const stateScore = (latestMonthByState[state.toUpperCase()] || 0) / maxVacancy

      for (const code of Object.keys(scoreMap)) {
        scoreMap[code].regional_score = stateScore
      }
    }

    // Step 4 — Weighted final score (same weights as it2)
    let interestWeight, skillWeight, regionalWeight
    if (hasSkills && hasRegion) {
      interestWeight = 0.5; skillWeight = 0.3; regionalWeight = 0.2
    } else if (hasSkills) {
      interestWeight = 0.7; skillWeight = 0.3; regionalWeight = 0
    } else if (hasRegion) {
      interestWeight = 0.7; skillWeight = 0; regionalWeight = 0.3
    } else {
      interestWeight = 1.0; skillWeight = 0; regionalWeight = 0
    }

    const ranked = Object.values(scoreMap)
      .map(item => {
        const interest_pct = item.interest_score / uniqueCodes.length
        const final_score = Math.round(
          (interest_pct * interestWeight +
           item.skill_score * skillWeight +
           item.regional_score * regionalWeight) * 100
        )
        return {
          anzsco_code: item.occupation.anzsco_code,
          name: item.occupation.name,
          category: item.occupation.category,
          interest_code: item.occupation.interest_code,
          match_score: final_score,
          match_label: getMatchLabel(final_score),
          interests_matched: item.interest_score,
          total_interests: uniqueCodes.length,
          skill_match_pct: hasSkills ? Math.round(item.skill_score * 100) : null,
          regional_demand_score: hasRegion ? Math.round(item.regional_score * 100) : null,
        }
      })
      .filter(item => item.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .map((item, index) => ({ rank: index + 1, ...item }))

    res.json(ranked.slice(0, 10))
  } catch (error) {
    console.error("POST /api/v3/occupations/match error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// ── GET /api/v3/occupations/:anzsco_code 
// Single occupation with resilience score — same formula as it2
router.get("/:anzsco_code", async (req, res) => {
  try {
    const { anzsco_code } = req.params

    const occupation = await prisma.occupations.findUnique({
      where: { anzsco_code },
      include: {
        occupation_employment: { orderBy: { year: "asc" } },
        tasks: true,
      },
    })

    if (!occupation) {
      return res.status(404).json({ error: "Occupation not found" })
    }

    // AI Resilience Score — same formula as it2
    // Pulls from public.jsa_task_score using 4-digit unit group
    const unitGroup = anzsco_code.slice(0, 4)
    const jsaScores = await prisma.$queryRaw`
      SELECT automation_score, augmentation_score
      FROM jsa_task_score
      WHERE anzsco_unit_group = ${unitGroup}
        AND automation_score IS NOT NULL
        AND augmentation_score IS NOT NULL
    `

    let resilienceScore = null
    let resilienceLabel = "Not available"
    let avgAutomation = null
    let avgAugmentation = null

    if (jsaScores.length > 0) {
      avgAutomation = jsaScores.reduce((sum, r) => sum + parseFloat(r.automation_score), 0) / jsaScores.length
      avgAugmentation = jsaScores.reduce((sum, r) => sum + parseFloat(r.augmentation_score), 0) / jsaScores.length
      // Exact it2 formula: 0.4 × (1 - avg_automation) + 0.6 × avg_augmentation
      resilienceScore = Math.round((0.4 * (1 - avgAutomation) + 0.6 * avgAugmentation) * 100)
      resilienceLabel = getResilienceLabel(resilienceScore)
    }

    // Task counts from it3 tasks table
    const tasks = occupation.tasks
    const totalTasks = tasks.length
    const humanLed = tasks.filter(t => t.impact_group === "Human-led").length
    const aiAssisted = tasks.filter(t => t.impact_group === "AI-assisted").length
    const aiAutomated = tasks.filter(t => t.impact_group === "AI-automated").length

    res.json({
      anzsco_code: occupation.anzsco_code,
      name: occupation.name,
      category: occupation.category,
      interest_code: occupation.interest_code,
      resilience_score: resilienceScore,
      resilience_label: resilienceLabel,
      avg_automation: avgAutomation != null ? Math.round(avgAutomation * 100) / 100 : null,
      avg_augmentation: avgAugmentation != null ? Math.round(avgAugmentation * 100) / 100 : null,
      task_counts: {
        total: totalTasks,
        human_led: humanLed,
        ai_assisted: aiAssisted,
        ai_automated: aiAutomated,
      },
      employment_trend: occupation.occupation_employment.map(e => ({
        year: e.year,
        employed_k: parseFloat(e.employed_k),
      })),
    })
  } catch (error) {
    console.error("GET /api/v3/occupations/:anzsco_code error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// ── GET /api/v3/occupations/:anzsco_code/tasks 
// Returns tasks grouped by impact + enriched with it2-style labels
// Also joins jsa_task_score scores where available for automation/augmentation details
router.get("/:anzsco_code/tasks", async (req, res) => {
  try {
    const { anzsco_code } = req.params

    const tasks = await prisma.tasks.findMany({
      where: { anzsco_code },
      orderBy: { impact_group: "asc" },
    })

    if (!tasks.length) {
      return res.status(404).json({ error: "No tasks found for this occupation" })
    }

    // Pull jsa scores for enrichment (same as it2 /ai endpoint)
    const unitGroup = anzsco_code.slice(0, 4)
    const jsaScores = await prisma.$queryRaw`
      SELECT task_text, automation_score, augmentation_score,
             automation_justification, augmentation_justification
      FROM jsa_task_score
      WHERE anzsco_unit_group = ${unitGroup}
    `

    // Build lookup by lowercase task text
    const jsaMap = {}
    for (const row of jsaScores) {
      jsaMap[row.task_text.toLowerCase().trim()] = row
    }

    // Enrich tasks with jsa scores where available + it2-style labels
    const enrichedTasks = tasks.map(t => {
      const jsa = jsaMap[t.task_core.toLowerCase().trim()]
      const autoScore = jsa?.automation_score != null ? parseFloat(jsa.automation_score) : null
      const augScore = jsa?.augmentation_score != null ? parseFloat(jsa.augmentation_score) : null

      return {
        task_id: t.task_id,
        task_core: t.task_core,
        impact_group: t.impact_group,
        impact_level: t.impact_level,
        human_need_type: t.human_need_type,
        short_explanation: t.short_explanation,
        automation_score: autoScore,
        augmentation_score: augScore,
        automation_label: autoScore != null ? getTaskLabel(autoScore) : "Not available",
        augmentation_label: augScore != null ? getTaskLabel(augScore) : "Not available",
        plain_english: augScore != null && autoScore != null
          ? augScore > autoScore
            ? "AI is more likely to help with this task"
            : "AI may automate parts of this task"
          : null,
      }
    })

    const grouped = {
      "Human-led": enrichedTasks.filter(t => t.impact_group === "Human-led"),
      "AI-assisted": enrichedTasks.filter(t => t.impact_group === "AI-assisted"),
      "AI-automated": enrichedTasks.filter(t => t.impact_group === "AI-automated"),
    }

    res.json({
      anzsco_code,
      total: tasks.length,
      grouped,
    })
  } catch (error) {
    console.error("GET /api/v3/occupations/:anzsco_code/tasks error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// ── GET /api/v3/occupations/:anzsco_code/skills
// Top skills ordered by position (importance)
router.get("/:anzsco_code/skills", async (req, res) => {
  try {
    const { anzsco_code } = req.params

    const occSkills = await prisma.occupation_skills.findMany({
      where: { anzsco_code, position: { not: null } },
      include: { skills: true },
      orderBy: { position: "asc" },
    })

    if (!occSkills.length) {
      return res.status(404).json({ error: "No skills found for this occupation" })
    }

    const skills = occSkills.map(os => ({
      skill_id: os.skill_id,
      name: os.skills.name,
      skill_type: os.skills.skill_type,
      position: os.position,
      score: os.score ? parseFloat(os.score) : null,
      stars: os.stars ? parseFloat(os.stars) : null,
    }))

    res.json({ anzsco_code, skills })
  } catch (error) {
    console.error("GET /api/v3/occupations/:anzsco_code/skills error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// ── GET /api/v3/occupations/:anzsco_code/employment 
// Employment trend with growth stats
router.get("/:anzsco_code/employment", async (req, res) => {
  try {
    const { anzsco_code } = req.params

    const employment = await prisma.occupation_employment.findMany({
      where: { anzsco_code },
      orderBy: { year: "asc" },
    })

    if (!employment.length) {
      return res.status(404).json({ error: "No employment data found for this occupation" })
    }

    const trend = employment.map(e => ({
      year: e.year,
      employed_k: parseFloat(e.employed_k),
    }))

    const first = trend[0].employed_k
    const last = trend[trend.length - 1].employed_k
    const totalChange = last - first
    const totalPctChange = first > 0 ? ((totalChange / first) * 100).toFixed(1) : 0
    const years = trend.length - 1
    const cagr = first > 0 && years > 0
      ? ((Math.pow(last / first, 1 / years) - 1) * 100).toFixed(2)
      : 0

    res.json({
      anzsco_code,
      trend,
      growth: {
        from_year: trend[0].year,
        to_year: trend[trend.length - 1].year,
        employed_start_k: first,
        employed_end_k: last,
        total_change_k: parseFloat(totalChange.toFixed(4)),
        total_pct_change: parseFloat(totalPctChange),
        cagr_pct: parseFloat(cagr),
      },
    })
  } catch (error) {
    console.error("GET /api/v3/occupations/:anzsco_code/employment error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router