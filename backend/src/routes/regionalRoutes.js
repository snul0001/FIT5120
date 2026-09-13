import express from "express"
import { prisma } from "../config/db.js"

const router = express.Router()

router.get("/opportunity", async (req, res) => {
  try {
    const { anzsco4, state, limit = 50 } = req.query

    if (!anzsco4) {
      return res.status(400).json({ error: "anzsco4 code is required" })
    }

    const where = { anzsco4_code: parseInt(anzsco4) }
    if (state) where.state_name = state

    const data = await prisma.regional_employment_opportunity.findMany({
      where,
      orderBy: { month: "desc" },
      take: parseInt(limit)
    })

    if (!data.length) {
      return res.status(404).json({ error: "No regional data found for this occupation" })
    }

    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// Get vacancy demand optionally filtered by state
router.get("/demand", async (req, res) => {
  try {
    const { state } = req.query

    const where = {}
    if (state) where.state_name = state

    const data = await prisma.regional_employment_demand.findMany({
      where,
      orderBy: { month: "asc" }
    })

    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// Get all ICT occupation group mappings
router.get("/occupations", async (req, res) => {
  try {
    const data = await prisma.regional_ict_occupation_mapping.findMany()
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router