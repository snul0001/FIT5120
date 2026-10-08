import express from "express"
import { prisma } from "../../config/db.js"

const router = express.Router()

// ── Helpers ──────────────────────────────────────────────────────────────────

function generatePlanCode(anzsco_code, duration_months) {
  const prefix = anzsco_code.slice(0, 3)
  const dur = `${duration_months}M`
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6)
  return `${prefix}-${dur}-${rand}`
}

async function generatePlanFromGroq(occupationName, missingSkills, durationMonths, hrsPerWeek) {
  const monthlyHrs = hrsPerWeek * 4
  const phases = durationMonths / 3
  const phaseNames = ["Foundation", "Building", "Mastery"]
  const skillList = missingSkills.map((s, i) => `${i + 1}. ${s.name} (importance: ${s.score || "N/A"})`).join("\n")

  // Build format example dynamically
  let formatExample = ""
  for (let p = 0; p < phases; p++) {
    const startMonth = p * 3 + 1
    const endMonth = p * 3 + 3
    const phaseName = phaseNames[p]
    formatExample += `PHASE: ${startMonth}-${endMonth} | ${phaseName}\n`
    for (let m = startMonth; m <= endMonth; m++) {
      formatExample += `MONTH: ${m}\n`
      formatExample += `SKILL: [skill name]\n`
      formatExample += `HOURS: [hrs] hrs\n`
      formatExample += `WHY: [one sentence specific to ${occupationName}]\n`
      formatExample += `RESOURCE: [platform name]\n`
      formatExample += `---\n`
    }
    if (p < phases - 1) formatExample += `===\n`
  }

  const prompt = `You are a career coach. Generate a personalised learning plan.

Occupation: ${occupationName}
Duration: ${durationMonths} months (${phases} phase${phases > 1 ? "s" : ""} of 3 months each)
Hours per week: ${hrsPerWeek} hrs/week (${monthlyHrs} hrs per month)

Skills to learn in priority order:
${skillList}

Rules:
- Create exactly ${phases} phase${phases > 1 ? "s" : ""}, each covering 3 months
- Each month gets 1-2 skills maximum
- Distribute highest importance skills in Phase 1 (Foundation)
- Hours per skill should be realistic based on ${monthlyHrs} hrs/month budget
- RESOURCE must be a real platform (Coursera, LinkedIn Learning, Udemy, AWS Training, Google Career Certificates, Microsoft Learn, YouTube)
- Do not add any text outside the format below
- You can add multiple SKILL/HOURS/WHY/RESOURCE/--- blocks per month for up to 2 skills

Use EXACTLY this format:

${formatExample}`

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }]
      })
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq API error: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content
}

function parsePlanResponse(rawText, missingSkills, durationMonths, hrsPerWeek) {
  const monthlyHrs = hrsPerWeek * 4
  const phaseNames = ["Foundation", "Building", "Mastery"]
  const result = []

  // Split into phases by ===
  const phaseSections = rawText.split("===").filter(s => s.trim())

  for (let pi = 0; pi < phaseSections.length; pi++) {
    const section = phaseSections[pi]
    const lines = section.trim().split("\n").map(l => l.trim()).filter(Boolean)

    let phaseLabel = ""
    let phaseFocus = phaseNames[pi] || "Advanced"
    let currentMonth = null
    let currentSkill = {}
    const months = []

    for (const line of lines) {
      if (line.startsWith("PHASE:")) {
        const parts = line.replace("PHASE:", "").trim().split("|")
        phaseLabel = parts[0]?.trim() || ""
        phaseFocus = parts[1]?.trim() || phaseFocus
      } else if (line.startsWith("MONTH:")) {
        // Save previous month if exists
        if (currentMonth) {
          if (currentSkill.name) {
            currentMonth.skills.push({ ...currentSkill, completed: false })
            currentSkill = {}
          }
          months.push(currentMonth)
        }
        const monthNum = line.replace("MONTH:", "").trim()
        currentMonth = {
          month: `Month ${monthNum}`,
          total_hrs: monthlyHrs,
          skills: []
        }
      } else if (line.startsWith("SKILL:")) {
        if (currentSkill.name && currentMonth) {
          currentMonth.skills.push({ ...currentSkill, completed: false })
        }
        currentSkill = { name: line.replace("SKILL:", "").trim(), completed: false }
      } else if (line.startsWith("HOURS:")) {
        currentSkill.hours = line.replace("HOURS:", "").trim()
      } else if (line.startsWith("WHY:")) {
        currentSkill.why = line.replace("WHY:", "").trim()
      } else if (line.startsWith("RESOURCE:")) {
        currentSkill.resource = line.replace("RESOURCE:", "").trim()
      } else if (line === "---") {
        if (currentSkill.name && currentMonth) {
          currentMonth.skills.push({ ...currentSkill, completed: false })
          currentSkill = {}
        }
      }
    }

    // Push last skill and month
    if (currentSkill.name && currentMonth) {
      currentMonth.skills.push({ ...currentSkill, completed: false })
    }
    if (currentMonth) months.push(currentMonth)

    if (months.length > 0) {
      result.push({
        phase: phaseLabel || `Months ${pi * 3 + 1}-${pi * 3 + 3}`,
        focus: phaseFocus,
        months
      })
    }
  }

  // Fallback — distribute skills evenly if Groq didn't follow format
  if (result.length === 0) {
    const totalPhases = durationMonths / 3
    const skillsPerPhase = Math.ceil(missingSkills.length / totalPhases)

    for (let p = 0; p < totalPhases; p++) {
      const phaseSkills = missingSkills.slice(p * skillsPerPhase, (p + 1) * skillsPerPhase)
      const startMonth = p * 3 + 1
      const months = []

      for (let m = 0; m < 3; m++) {
        const skill = phaseSkills[m]
        months.push({
          month: `Month ${startMonth + m}`,
          total_hrs: monthlyHrs,
          skills: skill ? [{
            name: skill.name,
            hours: `${Math.floor(monthlyHrs / 2)} hrs`,
            why: `Key skill for ${missingSkills[0]?.name || "this occupation"}`,
            resource: "Coursera or LinkedIn Learning",
            completed: false
          }] : []
        })
      }

      result.push({
        phase: `Months ${startMonth}-${startMonth + 2}`,
        focus: phaseNames[p] || "Advanced",
        months
      })
    }
  }

  return result
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/v3/plans
router.post("/", async (req, res) => {
  const { anzsco_code, occupation_name, duration_months, hrs_per_week, missing_skills = [] } = req.body

  if (!anzsco_code || !occupation_name || !duration_months || !hrs_per_week) {
    return res.status(400).json({ error: "anzsco_code, occupation_name, duration_months and hrs_per_week are required" })
  }

  if (![3, 6, 9].includes(duration_months)) {
    return res.status(400).json({ error: "duration_months must be 3, 6 or 9" })
  }

  if (missing_skills.length === 0) {
    return res.status(400).json({ error: "missing_skills cannot be empty" })
  }

  try {
    const rawPlan = await generatePlanFromGroq(occupation_name, missing_skills, duration_months, hrs_per_week)
    const phases = parsePlanResponse(rawPlan, missing_skills, duration_months, hrs_per_week)

    // Generate unique plan code
    let plan_code = generatePlanCode(anzsco_code, duration_months)
    let attempts = 0
    while (attempts < 5) {
      const existing = await prisma.learning_plans.findUnique({ where: { plan_code } })
      if (!existing) break
      plan_code = generatePlanCode(anzsco_code, duration_months)
      attempts++
    }

    const plan = await prisma.learning_plans.create({
      data: {
        plan_code,
        anzsco_code,
        occupation_name,
        duration_months,
        hrs_per_week,
        skills: phases
      }
    })

    const allSkills = phases.flatMap(p => p.months.flatMap(m => m.skills))

    res.json({
      plan_code: plan.plan_code,
      occupation_name: plan.occupation_name,
      anzsco_code: plan.anzsco_code,
      duration_months: plan.duration_months,
      hrs_per_week: plan.hrs_per_week,
      created_at: plan.created_at,
      phases,
      total_skills: allSkills.length,
      total_hrs: duration_months * hrs_per_week * 4,
      progress_url: `/progress/${plan.plan_code}`
    })

  } catch (error) {
    console.error("POST /api/v3/plans error:", error)
    res.status(500).json({ error: "Failed to generate plan. Please try again." })
  }
})

// GET /api/v3/plans/:code
router.get("/:code", async (req, res) => {
  try {
    const { code } = req.params

    const plan = await prisma.learning_plans.findUnique({
      where: { plan_code: code.toUpperCase() }
    })

    if (!plan) {
      return res.status(404).json({ error: "Plan not found. Check your code and try again." })
    }

    const phases = plan.skills
    const allSkills = phases.flatMap(p => p.months.flatMap(m => m.skills))
    const totalSkills = allSkills.length
    const completedSkills = allSkills.filter(s => s.completed).length
    const progressPct = totalSkills > 0 ? Math.round((completedSkills / totalSkills) * 100) : 0

    res.json({
      plan_code: plan.plan_code,
      occupation_name: plan.occupation_name,
      anzsco_code: plan.anzsco_code,
      duration_months: plan.duration_months,
      hrs_per_week: plan.hrs_per_week,
      created_at: plan.created_at,
      phases,
      progress: {
        total_skills: totalSkills,
        completed_skills: completedSkills,
        progress_pct: progressPct
      }
    })

  } catch (error) {
    console.error("GET /api/v3/plans/:code error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// PATCH /api/v3/plans/:code
// Body: { phases } — full updated phases array with completed booleans
router.patch("/:code", async (req, res) => {
  try {
    const { code } = req.params
    const { phases } = req.body

    if (!phases || !Array.isArray(phases)) {
      return res.status(400).json({ error: "phases array is required" })
    }

    const plan = await prisma.learning_plans.findUnique({
      where: { plan_code: code.toUpperCase() }
    })

    if (!plan) {
      return res.status(404).json({ error: "Plan not found." })
    }

    await prisma.learning_plans.update({
      where: { plan_code: code.toUpperCase() },
      data: { skills: phases }
    })

    const allSkills = phases.flatMap(p => p.months.flatMap(m => m.skills))
    const totalSkills = allSkills.length
    const completedSkills = allSkills.filter(s => s.completed).length
    const progressPct = totalSkills > 0 ? Math.round((completedSkills / totalSkills) * 100) : 0

    let message = ""
    if (progressPct === 100) {
      message = "🎉 Plan complete! You've built serious AI readiness."
    } else if (progressPct >= 66) {
      message = `Amazing — you're ${progressPct}% done. Almost there!`
    } else if (progressPct >= 33) {
      message = `Solid progress! You're ${progressPct}% through your plan.`
    } else {
      message = `Great start! You've completed ${completedSkills} skill${completedSkills !== 1 ? "s" : ""}. Keep going!`
    }

    res.json({
      plan_code: plan.plan_code,
      progress: {
        total_skills: totalSkills,
        completed_skills: completedSkills,
        progress_pct: progressPct
      },
      message
    })

  } catch (error) {
    console.error("PATCH /api/v3/plans/:code error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router