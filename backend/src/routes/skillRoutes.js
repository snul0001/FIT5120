import express from "express"
import { prisma } from "../config/db.js"

const router = express.Router()

router.post("/gap", async (req, res) => {
  try {
    const { occupation_id, selected_skills } = req.body

    if (!occupation_id || !Array.isArray(selected_skills)) {
      return res.status(400).json({ error: "occupation_id and selected_skills array are required" })
    }

    const requirements = await prisma.occupation_skill_requirement.findMany({
      where: { occupation_id },
      orderBy: { importance_score: "desc" }
    })

    if (!requirements.length) {
      return res.status(404).json({ error: "No skill data found for this occupation" })
    }

    const selectedLower = selected_skills.map(s => s.toLowerCase().trim())

    const matched = []
    const missing = []

    for (const requirement of requirements) {
      const isMatch = selectedLower.some(s =>
        s === requirement.skill_id ||
        s === requirement.skill_name.toLowerCase().trim()
      )
      if (isMatch) {
        matched.push(requirement)
      } else {
        missing.push(requirement)
      }
    }

    res.json({
      occupation_id,
      total_required: requirements.length,
      matched_count: matched.length,
      missing_count: missing.length,
      match_percentage: Math.round((matched.length / requirements.length) * 100),
      matched,
      missing
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router