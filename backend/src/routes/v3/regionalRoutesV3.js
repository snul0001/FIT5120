import express from "express"
import { prisma } from "../../config/db.js"

const router = express.Router()

// GET /api/v3/regional/:anzsco_code
// Returns employment by state for a specific occupation
// Optional query params: ?state=VIC, ?from=2020-01, ?to=2026-08
router.get("/:anzsco_code", async (req, res) => {
  try {
    const { anzsco_code } = req.params
    const { state, from, to } = req.query

    // Build date filters
    const dateFilter = {}
    if (from) dateFilter.gte = new Date(from + "-01")
    if (to) dateFilter.lte = new Date(to + "-01")

    // Build region filter
    const regionFilter = state
      ? { regions: { state: state.toUpperCase() } }
      : {}

    const employment = await prisma.regional_employment.findMany({
      where: {
        anzsco_code,
        ...(Object.keys(dateFilter).length > 0 ? { month: dateFilter } : {}),
        ...regionFilter,
      },
      include: {
        regions: {
          select: {
            region_code: true,
            name: true,
            level: true,
            state: true,
          }
        }
      },
      orderBy: [
        { month: "asc" },
        { region_code: "asc" },
      ]
    })

    if (!employment.length) {
      return res.status(404).json({ error: "No regional employment data found for this occupation" })
    }

    // Group by state for summary
    const byState = {}
    for (const row of employment) {
      const state = row.regions.state
      if (!byState[state]) byState[state] = { state, total_employed: 0, months: [] }
      byState[state].total_employed += row.employed
    }

    // Get latest month data for current snapshot
    const latestMonth = employment[employment.length - 1].month
    const latestData = employment.filter(e =>
      e.month.toISOString().slice(0, 7) === latestMonth.toISOString().slice(0, 7)
    )

    const stateSnapshot = latestData.reduce((acc, row) => {
      const s = row.regions.state
      if (!acc[s]) acc[s] = { state: s, employed: 0, regions: [] }
      acc[s].employed += row.employed
      acc[s].regions.push({
        region_code: row.regions.region_code,
        region_name: row.regions.name,
        employed: row.employed
      })
      return acc
    }, {})

    // Monthly trend — aggregate across all regions
    const monthlyTrend = {}
    for (const row of employment) {
      const month = row.month.toISOString().slice(0, 7)
      if (!monthlyTrend[month]) monthlyTrend[month] = 0
      monthlyTrend[month] += row.employed
    }

    res.json({
      anzsco_code,
      latest_month: latestMonth.toISOString().slice(0, 7),
      state_snapshot: Object.values(stateSnapshot).sort((a, b) => b.employed - a.employed),
      monthly_trend: Object.entries(monthlyTrend).map(([month, employed]) => ({
        month,
        employed
      })),
      total_records: employment.length,
    })

  } catch (error) {
    console.error("GET /api/v3/regional/:anzsco_code error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

// GET /api/v3/regional/:anzsco2_code/vacancies
// Returns vacancy trends by region for an ANZSCO2 group
// e.g. /api/v3/regional/26/vacancies for ICT Professionals
router.get("/:anzsco2_code/vacancies", async (req, res) => {
  try {
    const { anzsco2_code } = req.params
    const { state } = req.query

    const regionFilter = state
      ? { regions: { state: state.toUpperCase() } }
      : {}

    const vacancies = await prisma.regional_vacancies.findMany({
      where: {
        anzsco2_code,
        ...regionFilter,
      },
      include: {
        regions: {
          select: {
            region_code: true,
            name: true,
            level: true,
            state: true,
          }
        }
      },
      orderBy: [
        { month: "asc" },
        { region_code: "asc" },
      ]
    })

    if (!vacancies.length) {
      return res.status(404).json({ error: "No vacancy data found for this occupation group" })
    }

    // Monthly national trend
    const monthlyTrend = {}
    for (const row of vacancies) {
      const month = row.month.toISOString().slice(0, 7)
      if (!monthlyTrend[month]) monthlyTrend[month] = 0
      monthlyTrend[month] += parseFloat(row.vacancies_3m_avg)
    }

    // Latest snapshot by state
    const latestMonth = vacancies[vacancies.length - 1].month
    const latestData = vacancies.filter(v =>
      v.month.toISOString().slice(0, 7) === latestMonth.toISOString().slice(0, 7)
    )

    const stateSnapshot = latestData.reduce((acc, row) => {
      const s = row.regions.state
      if (!acc[s]) acc[s] = { state: s, vacancies: 0 }
      acc[s].vacancies += parseFloat(row.vacancies_3m_avg)
      return acc
    }, {})

    res.json({
      anzsco2_code,
      latest_month: latestMonth.toISOString().slice(0, 7),
      state_snapshot: Object.values(stateSnapshot).sort((a, b) => b.vacancies - a.vacancies),
      monthly_trend: Object.entries(monthlyTrend).map(([month, vacancies]) => ({
        month,
        vacancies: Math.round(vacancies)
      })),
      total_records: vacancies.length,
    })

  } catch (error) {
    console.error("GET /api/v3/regional/:anzsco2_code/vacancies error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

export default router