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

    // Merge duplicate tasks
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

    // Calculate averages excluding nulls
    const autoScores = cleanedTasks.map(t => t.automation_score).filter(v => v != null)
    const augScores = cleanedTasks.map(t => t.augmentation_score).filter(v => v != null)

    const avg_automation = autoScores.length ? autoScores.reduce((a, b) => a + b, 0) / autoScores.length : null
    const avg_augmentation = augScores.length ? augScores.reduce((a, b) => a + b, 0) / augScores.length : null

    const resilience_score = avg_augmentation != null && avg_automation != null
      ? Math.round(((avg_augmentation - avg_automation + 1) / 2) * 100)
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
    const { interest_ids } = req.body

    if (
      !Array.isArray(interest_ids) ||
      interest_ids.length === 0 ||
      interest_ids.some(id => typeof id !== "string")
    ) {
      return res.status(400).json({ error: "interest_ids must be a non-empty array of strings" })
    }

    const uniqueInterestIds = [...new Set(interest_ids)]

    const matches = await prisma.occupation_interest.findMany({
      where: { interest_id: { in: uniqueInterestIds } },
      include: {
        occupation: {
          include: { industry_sector: true }
        }
      }
    })

    const scoreMap = {}
    for (const match of matches) {
      if (!match.occupation) continue
      const id = match.occupation_id
      if (!scoreMap[id]) scoreMap[id] = { occupation: match.occupation, score: 0 }
      scoreMap[id].score += 1
    }

    const ranked = Object.values(scoreMap)
      .sort((a, b) => b.score - a.score)
      .map((item, index) => {
        const match_score = Math.round((item.score / uniqueInterestIds.length) * 100)
        return {
          rank: index + 1,
          occupation_id: item.occupation.occupation_id,
          title: item.occupation.title,
          sector: item.occupation.industry_sector?.label || "ICT",
          match_score,
          match_label: getMatchLabel(match_score),
          interests_matched: item.score,
          total_interests: uniqueInterestIds.length
        }
      })

    res.json(ranked)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router