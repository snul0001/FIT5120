import express from "express"
import { prisma } from "../../config/db.js"

const router = express.Router()

// POST /api/v3/skills/gap
// Body: { anzsco_code: string, user_skills: string[] }
// Returns matched and missing skills for an occupation vs user's skills
router.post("/gap", async (req, res) => {
  try {
    const { anzsco_code, user_skills = [] } = req.body

    if (!anzsco_code) {
      return res.status(400).json({ error: "anzsco_code is required" })
    }

    // Get top 10 skills for this occupation
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

    const userSkillsLower = user_skills.map(s => s.toLowerCase().trim())

    const matched = []
    const missing = []

    for (const os of occSkills) {
      const skillName = os.skills.name.toLowerCase().trim()
      const isMatch = userSkillsLower.some(s => s === skillName || skillName.includes(s) || s.includes(skillName))

      const skillData = {
        skill_id: os.skill_id,
        name: os.skills.name,
        skill_type: os.skills.skill_type,
        position: os.position,
        score: os.score ? parseFloat(os.score) : null,
        stars: os.stars ? parseFloat(os.stars) : null,
      }

      if (isMatch) {
        matched.push(skillData)
      } else {
        missing.push(skillData)
      }
    }

    const totalRequired = occSkills.length
    const matchPct = Math.round((matched.length / totalRequired) * 100)

    res.json({
      anzsco_code,
      total_required: totalRequired,
      matched_count: matched.length,
      missing_count: missing.length,
      match_percentage: matchPct,
      matched,
      missing,
    })
  } catch (error) {
    console.error("POST /api/v3/skills/gap error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router