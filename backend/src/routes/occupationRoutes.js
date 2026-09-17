import express from "express"
import { prisma } from "../config/db.js"

const router = express.Router()

const getMatchLabel = (score) => {
  if (score >= 80) return "Strong match"
  if (score >= 50) return "Good match"
  return "Possible match"
}

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

const shortageMap = {
  "2621": "shortage",
  "2632": "shortage",
  "2613": "no_shortage",
  "2612": "no_shortage",
  "2611": "no_shortage",
  "2631": "no_shortage",
  "1351": "no_shortage",
}

const getDemandLabel = (anzscoGroup) => {
  if (shortageMap[anzscoGroup] === "shortage") return "High — Currently in national shortage"
  if (shortageMap[anzscoGroup] === "no_shortage") return "Moderate — No current national shortage"
  return "Not available"
}

router.get("/", async (req, res) => {
  try {
    const occupations = await prisma.occupation.findMany({
      where: { is_curated: true },
      include: { industry_sector: true },
      orderBy: { title: "asc" }
    })
    res.json(occupations)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const occupation = await prisma.occupation.findUnique({
      where: { occupation_id: req.params.id },
      include: { industry_sector: true }
    })
    if (!occupation) return res.status(404).json({ error: "Occupation not found" })
    res.json(occupation)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

router.get("/:id/ai", async (req, res) => {
  try {
    const matches = await prisma.occupation_anzsco_match.findMany({
      where: { occupation_id: req.params.id }
    })

    if (!matches.length) {
      return res.json({
        tasks: [], avg_automation: null, avg_augmentation: null,
        resilience_score: null, resilience_label: "Not available",
        demand_label: "Not available",
        data_sources: {
          ai_task_scores: "Jobs and Skills Australia Gen AI Capacity Study 2025",
          demand: "Jobs and Skills Australia Occupation Shortage List 2025"
        }
      })
    }

    const unitGroups = [...new Set(matches.map(m => m.anzsco_unit_group))]
    const tasks = await prisma.jsa_task_score.findMany({
      where: { anzsco_unit_group: { in: unitGroups } }
    })

    if (!tasks.length) {
      return res.json({
        tasks: [], avg_automation: null, avg_augmentation: null,
        resilience_score: null, resilience_label: "Not available",
        demand_label: getDemandLabel(unitGroups[0]),
        data_sources: {
          ai_task_scores: "Jobs and Skills Australia Gen AI Capacity Study 2025",
          demand: "Jobs and Skills Australia Occupation Shortage List 2025"
        }
      })
    }

    const mergedMap = {}
    for (const t of tasks) {
      const key = t.task_text.toLowerCase().trim()
      if (!mergedMap[key]) {
        mergedMap[key] = {
          task_text: t.task_text,
          anzsco_unit_group: t.anzsco_unit_group,
          automation_score: Number(t.automation_score) || null,
          augmentation_score: Number(t.augmentation_score) || null,
          automation_justification: t.automation_justification || "",
          augmentation_justification: t.augmentation_justification || ""
        }
      } else {
        if (Number(t.automation_score) > 0) {
          mergedMap[key].automation_score = Number(t.automation_score)
          mergedMap[key].automation_justification = t.automation_justification || ""
        }
        if (Number(t.augmentation_score) > 0) {
          mergedMap[key].augmentation_score = Number(t.augmentation_score)
          mergedMap[key].augmentation_justification = t.augmentation_justification || ""
        }
      }
    }

    const cleanedTasks = Object.values(mergedMap).map(t => ({
      ...t,
      automation_label: t.automation_score != null ? getTaskLabel(t.automation_score) : "Not available",
      augmentation_label: t.augmentation_score != null ? getTaskLabel(t.augmentation_score) : "Not available",
      plain_english: (t.augmentation_score ?? 0) > (t.automation_score ?? 0)
        ? "AI is more likely to help with this task"
        : "AI may automate parts of this task"
    }))

    const autoScores = cleanedTasks.map(t => t.automation_score).filter(v => v != null)
    const augScores = cleanedTasks.map(t => t.augmentation_score).filter(v => v != null)

    const avg_automation = autoScores.length ? autoScores.reduce((a, b) => a + b, 0) / autoScores.length : null
    const avg_augmentation = augScores.length ? augScores.reduce((a, b) => a + b, 0) / augScores.length : null

    const resilience_score = avg_augmentation != null && avg_automation != null
    ? Math.round((0.4 * (1 - avg_automation) + 0.6 * avg_augmentation) * 100)
    : null

    const demand_label = getDemandLabel(unitGroups[0])

    res.json({
      tasks: cleanedTasks,
      avg_automation: avg_automation != null ? Math.round(avg_automation * 100) / 100 : null,
      avg_augmentation: avg_augmentation != null ? Math.round(avg_augmentation * 100) / 100 : null,
      resilience_score,
      resilience_label: resilience_score != null ? getResilienceLabel(resilience_score) : "Not available",
      demand_label,
      data_sources: {
        ai_task_scores: "Jobs and Skills Australia Gen AI Capacity Study 2025",
        demand: "Jobs and Skills Australia Occupation Shortage List 2025"
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

router.post("/match", async (req, res) => {
  try {
    const { interest_ids, skill_ids, region } = req.body

    if (
      !Array.isArray(interest_ids) ||
      interest_ids.length === 0 ||
      interest_ids.some(id => typeof id !== "string")
    ) {
      return res.status(400).json({ error: "interest_ids must be a non-empty array of strings" })
    }

    const uniqueInterestIds = [...new Set(interest_ids)]
    const hasSkills = Array.isArray(skill_ids) && skill_ids.length > 0
    const hasRegion = !!region

    // Step 1 — Interest matching (always runs)
    const matches = await prisma.occupation_interest.findMany({
    where: { interest_id: { in: uniqueInterestIds } },
    include: {
    occupation: true
  }
})

    const scoreMap = {}
    for (const match of matches) {
      if (!match.occupation) continue
      const id = match.occupation_id
      if (!scoreMap[id]) scoreMap[id] = {
        occupation: match.occupation,
        interest_score: 0,
        skill_score: 0,
        regional_score: 0
      }
      scoreMap[id].interest_score += 1
    }

    // Step 2 — Skill overlap scoring (optional)
    if (hasSkills) {
      const selectedLower = skill_ids.map(s => s.toLowerCase().trim())
      for (const occupationId of Object.keys(scoreMap)) {
        const requirements = await prisma.occupation_skill_requirement.findMany({
          where: { occupation_id: occupationId }
        })
        if (requirements.length > 0) {
          const matchedSkills = requirements.filter(r =>
            selectedLower.some(s =>
              s === r.skill_id || s === r.skill_name.toLowerCase().trim()
            )
          )
          scoreMap[occupationId].skill_score = matchedSkills.length / requirements.length
        }
      }
    }

    // Step 3 — Regional demand scoring (optional)
    if (hasRegion) {
  // Step 1 — Fetch latest vacancy data for ALL states not just Jordan's state
  // We need all states so we can compare Jordan's state against the national maximum
  const allRegionalData = await prisma.regional_employment_demand.findMany({
    orderBy: { month: "desc" },
    take: 1000
  })

  // Step 2 — Get the most recent vacancy number per state
  // Data is ordered by month descending so first time we see a state = most recent month
  const latestByState = {}
  for (const row of allRegionalData) {
    if (!latestByState[row.state_name]) {
      latestByState[row.state_name] = Number(row.vacancy_3m_moving_average)
    }
  }

  // Step 3 — Find the national maximum across all states
  // This is used to normalise Jordan's chosen state against the best performing state
  const maxVacancy = Math.max(...Object.values(latestByState), 1)

  // Step 4 — Calculate Jordan's state score as a fraction of the national maximum
  // NSW = 1994/1994 = 1.0 (highest)
  // VIC = 1542/1994 = 0.77
  // QLD = 860/1994  = 0.43
  // TAS = 91/1994   = 0.046 (lowest)
  const stateScore = (latestByState[region] || 0) / maxVacancy

  // Step 5 — Apply same state score to all occupations
  // Every occupation in the same state gets the same regional score
  // because JSA vacancy data is at the broad ICT group level not individual occupation level
  for (const occupationId of Object.keys(scoreMap)) {
    scoreMap[occupationId].regional_score = stateScore
  }
}

    // Step 4 — Weighted final score
    let interestWeight, skillWeight, regionalWeight

    if (hasSkills && hasRegion) {
      interestWeight = 0.5
      skillWeight = 0.3
      regionalWeight = 0.2
    } else if (hasSkills) {
      interestWeight = 0.7
      skillWeight = 0.3
      regionalWeight = 0
    } else if (hasRegion) {
      interestWeight = 0.7
      skillWeight = 0
      regionalWeight = 0.3
    } else {
      interestWeight = 1.0
      skillWeight = 0
      regionalWeight = 0
    }

    const ranked = Object.values(scoreMap)
      .map(item => {
        const interest_pct = item.interest_score / uniqueInterestIds.length
        const final_score = Math.round(
          ((interest_pct * interestWeight) +
          (item.skill_score * skillWeight) +
          (item.regional_score * regionalWeight)) * 100
        )
        return {
          occupation_id: item.occupation.occupation_id,
          title: item.occupation.title,
          sector: "Information and Communications Technology",
          match_score: final_score,
          match_label: getMatchLabel(final_score),
          interests_matched: item.interest_score,
          total_interests: uniqueInterestIds.length,
          skill_match_pct: hasSkills ? Math.round(item.skill_score * 100) : null,
          regional_demand_score: hasRegion ? Math.round(item.regional_score * 100) : null
        }
      })
      .sort((a, b) => b.match_score - a.match_score)
      .map((item, index) => ({ rank: index + 1, ...item }))

    res.json(ranked.slice(0, 10))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router