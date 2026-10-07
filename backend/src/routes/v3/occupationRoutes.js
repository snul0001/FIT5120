import express from "express"
import { prisma } from "../../config/db.js"

const router = express.Router()

// GET /api/v3/occupations
// Returns all 81 occupations — optional ?category=ICT filter
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
      },
      orderBy: { name: "asc" },
    })

    res.json({ occupations })
  } catch (error) {
    console.error("GET /api/v3/occupations error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// GET /api/v3/occupations/:anzsco_code
// Returns a single occupation with employment trend and AI resilience score
router.get("/:anzsco_code", async (req, res) => {
  try {
    const { anzsco_code } = req.params

    const occupation = await prisma.occupations.findUnique({
      where: { anzsco_code },
      include: {
        occupation_employment: {
          orderBy: { year: "asc" },
        },
        tasks: true,
      },
    })

    if (!occupation) {
      return res.status(404).json({ error: "Occupation not found" })
    }

    // Calculate AI resilience score from tasks
    const tasks = occupation.tasks
    const totalTasks = tasks.length
    const humanLed = tasks.filter(t => t.impact_group === "Human-led").length
    const aiAssisted = tasks.filter(t => t.impact_group === "AI-assisted").length
    const aiAutomated = tasks.filter(t => t.impact_group === "AI-automated").length

    // Resilience = % of tasks that are human-led or AI-assisted (not fully automated)
    const resilienceScore = totalTasks > 0
      ? Math.round(((humanLed + aiAssisted * 0.5) / totalTasks) * 100)
      : 0

    const augmentationPct = totalTasks > 0 ? Math.round((aiAssisted / totalTasks) * 100) : 0
    const automationPct = totalTasks > 0 ? Math.round((aiAutomated / totalTasks) * 100) : 0

    res.json({
      anzsco_code: occupation.anzsco_code,
      name: occupation.name,
      category: occupation.category,
      resilience_score: resilienceScore,
      augmentation_pct: augmentationPct,
      automation_pct: automationPct,
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

// GET /api/v3/occupations/:anzsco_code/tasks
// Returns all tasks for an occupation grouped by AI impact category
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

    const grouped = {
      "Human-led": tasks.filter(t => t.impact_group === "Human-led"),
      "AI-assisted": tasks.filter(t => t.impact_group === "AI-assisted"),
      "AI-automated": tasks.filter(t => t.impact_group === "AI-automated"),
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

// GET /api/v3/occupations/:anzsco_code/skills
// Returns top 10 skills for an occupation ordered by importance
router.get("/:anzsco_code/skills", async (req, res) => {
  try {
    const { anzsco_code } = req.params

    const occSkills = await prisma.occupation_skills.findMany({
      where: {
        anzsco_code,
        position: { not: null },
      },
      include: {
        skills: true,
      },
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

// GET /api/v3/occupations/:anzsco_code/employment
// Returns employment trend 2020-2025 with growth stats
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

    // Calculate growth stats
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