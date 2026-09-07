import express from "express"
import { prisma } from "../config/db.js"

const router = express.Router()

router.get("/interests", async (req, res) => {
  try {
    const interests = await prisma.interest.findMany({ orderBy: { label: "asc" } })
    res.json(interests)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

router.get("/skills", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15))
    const search = req.query.search || ""
    const where = {
      category: "technical",
      ...(search && { label: { contains: search, mode: "insensitive" } })
    }
    const [skills, total] = await Promise.all([
      prisma.skill_tag.findMany({ where, orderBy: { label: "asc" }, skip: (page - 1) * limit, take: limit }),
      prisma.skill_tag.count({ where })
    ])
    res.json({ skills, total, page, pages: Math.ceil(total / limit), has_next: page < Math.ceil(total / limit) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

router.get("/work-styles", async (req, res) => {
  try {
    const workStyles = await prisma.work_style.findMany({ orderBy: { label: "asc" } })
    res.json(workStyles)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router