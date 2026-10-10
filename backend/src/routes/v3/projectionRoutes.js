import express from "express"
import { prisma } from "../../config/db.js"

const router = express.Router()

// ── GET /api/v3/occupations/:anzsco_code/projection ───────────────────────────
// Returns historical employment (2020–2025) + projected employment (2026–2030)
// Projection uses CAGR calculated from the occupation_growth view
// Response shaped for a line graph with historical vs projected series
router.get("/:anzsco_code/projection", async (req, res) => {
  try {
    const { anzsco_code } = req.params

    // Get historical employment trend (already stored year by year)
    const employment = await prisma.occupation_employment.findMany({
      where: { anzsco_code },
      orderBy: { year: "asc" },
    })

    if (!employment.length) {
      return res.status(404).json({ error: "No employment data found for this occupation" })
    }

    // Get CAGR from the occupation_growth view
    const growthData = await prisma.$queryRaw`
      SELECT
        employed_2020_k,
        employed_2025_k,
        total_change_k,
        total_pct_change,
        cagr
      FROM occupation_growth
      WHERE anzsco_code = ${anzsco_code}
    `

    if (!growthData.length) {
      return res.status(404).json({ error: "No growth data found for this occupation" })
    }

    const { cagr, employed_2025_k, total_pct_change } = growthData[0]
    const cagrFloat = parseFloat(cagr)
    const base = parseFloat(employed_2025_k)

    // Build historical series
    const historical = employment.map(e => ({
      year: e.year,
      employed_k: parseFloat(parseFloat(e.employed_k).toFixed(2)),
      type: "historical",
    }))

    // Project 2026–2030 using CAGR
    const projected = []
    for (let i = 1; i <= 5; i++) {
      const projectedYear = 2025 + i
      const projectedValue = base * Math.pow(1 + cagrFloat, i)
      projected.push({
        year: projectedYear,
        employed_k: parseFloat(projectedValue.toFixed(2)),
        type: "projected",
      })
    }

    // Growth label for UI
    const getGrowthLabel = (cagrVal) => {
      if (cagrVal >= 0.05) return "Strong growth"
      if (cagrVal >= 0.02) return "Moderate growth"
      if (cagrVal >= 0) return "Stable"
      if (cagrVal >= -0.02) return "Slight decline"
      return "Declining"
    }

    const getGrowthOutlook = (cagrVal) => {
      if (cagrVal >= 0.05) return "This occupation is projected to grow strongly — demand for workers is expected to increase significantly by 2030."
      if (cagrVal >= 0.02) return "This occupation shows steady growth — employment is expected to increase moderately by 2030."
      if (cagrVal >= 0) return "Employment in this occupation is expected to remain relatively stable through 2030."
      if (cagrVal >= -0.02) return "This occupation may see a slight decline in employment by 2030."
      return "This occupation is projected to decline — automation and industry changes may reduce demand for workers."
    }

    res.json({
      anzsco_code,
      cagr_pct: parseFloat((cagrFloat * 100).toFixed(2)),
      total_pct_change: parseFloat((parseFloat(total_pct_change) * 100).toFixed(1)),
      growth_label: getGrowthLabel(cagrFloat),
      growth_outlook: getGrowthOutlook(cagrFloat),
      chart: {
        historical,
        projected,
        combined: [...historical, ...projected],
      },
      summary: {
        base_year: 2025,
        base_employed_k: parseFloat(base.toFixed(2)),
        projected_2030_k: projected[projected.length - 1].employed_k,
        projected_change_k: parseFloat((projected[projected.length - 1].employed_k - base).toFixed(2)),
      },
    })
  } catch (error) {
    console.error("GET /api/v3/occupations/:anzsco_code/projection error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router