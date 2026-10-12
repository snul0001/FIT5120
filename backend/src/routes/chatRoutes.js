import express from "express"

const router = express.Router()

router.post("/", async (req, res) => {
  const { message, conversationHistory = [], profileContext = {} } = req.body

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required" })
  }

  try {
    const systemPrompt = buildSystemPrompt(profileContext)

    const messages = [
      ...conversationHistory,
      { role: "user", content: message }
    ]

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
          max_tokens: 500,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages
          ]
        })
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error("API error:", err)
      return res.status(500).json({ error: "AI service unavailable. Please try again." })
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content

    if (!reply) {
      return res.status(500).json({ error: "No response from AI. Please try again." })
    }

    res.json({ reply })

  } catch (error) {
    console.error("Chat route error:", error)
    res.status(500).json({ error: "Something went wrong. Please try again." })
  }
})

function buildSystemPrompt(ctx) {
  const {
    matchedCareers = [],
    selectedOccupation = null,
    skillGap = null,
    region = null,
    interestCodes = null,
    employmentTrend = null,
    taskBreakdown = null
  } = ctx

  let prompt = `You are an AI career advisor for IResi, an Australian career guidance platform for university students.
You help students explore career options, understand skill requirements, and learn how AI will affect their future work.

Your rules:
- Focus on careers, skills, employment trends, and AI impact across all industries
- Be honest, direct and concise — the student is not a corporate professional
- Ground your answers in the specific data provided below about the student's profile
- If the student asks something completely unrelated to careers or study (e.g. recipes, jokes, random trivia), just say something like "I'm here to help with your career questions — ask me anything about careers, skills or job trends!"
- Keep responses under 80 words. Be direct and conversational, not corporate.
- Do not make up salary figures, statistics or job data not provided below\n\n`

  // RIASEC interest profile
  if (interestCodes && interestCodes.length > 0) {
    const codeNames = {
      R: "Realistic (hands-on, practical)",
      I: "Investigative (analytical, research)",
      A: "Artistic (creative, expressive)",
      S: "Social (helping, teaching)",
      E: "Enterprising (leadership, business)",
      C: "Conventional (organised, detail-oriented)"
    }
    const codeList = interestCodes.map(c => codeNames[c] ?? c).join(", ")
    prompt += `Student's RIASEC interest profile: ${interestCodes.join("")} — ${codeList}\n\n`
  }

  // Top matched careers
  if (matchedCareers.length > 0) {
    prompt += `Student's top matched careers (from RIASEC quiz):\n`
    matchedCareers.slice(0, 5).forEach((c, i) => {
      const ai = c.ai ?? {}
      const resilience = ai.resilience_score ?? c.resilience_score ?? "N/A"
      const label = ai.resilience_label ? ` (${ai.resilience_label})` : ""
      prompt += `${i + 1}. ${c.title} — match score: ${c.match_score ?? "N/A"}, AI resilience: ${resilience}/100${label}\n`
    })
    prompt += "\n"
  }

  // Currently viewed occupation + AI breakdown
  if (selectedOccupation) {
    prompt += `Student is currently viewing: ${selectedOccupation.title}\n`

    if (taskBreakdown) {
      if (taskBreakdown.resilience_score != null) {
        prompt += `AI resilience score: ${taskBreakdown.resilience_score}/100 (${taskBreakdown.resilience_label ?? ""})\n`
      }
      if (taskBreakdown.human_led != null || taskBreakdown.ai_assisted != null || taskBreakdown.ai_automated != null) {
        prompt += `Task breakdown: ${taskBreakdown.human_led ?? 0} human-led tasks, ${taskBreakdown.ai_assisted ?? 0} AI-assisted tasks, ${taskBreakdown.ai_automated ?? 0} AI-automated tasks\n`
      }
      if (taskBreakdown.demand != null) prompt += `Demand (human judgment still needed): ${taskBreakdown.demand}%\n`
      if (taskBreakdown.augmentation != null) prompt += `Augmentation (AI helps but human leads): ${taskBreakdown.augmentation}%\n`
      if (taskBreakdown.automation != null) prompt += `Automation risk (AI replaces): ${taskBreakdown.automation}%\n`
    } else if (selectedOccupation.ai?.resilience_score != null) {
      prompt += `AI resilience score: ${selectedOccupation.ai.resilience_score}/100\n`
    }

    // Specific tasks the student can see
    if (selectedOccupation.tasks && selectedOccupation.tasks.length > 0) {
      prompt += `Key tasks for this role:\n`
      selectedOccupation.tasks.slice(0, 6).forEach(t => {
        prompt += `  - "${t.task}" → ${t.impact} (${t.level} impact)\n`
      })
    }
    prompt += "\n"
  }

  // Employment trend data
  if (employmentTrend && employmentTrend.length > 0) {
    const sorted = [...employmentTrend].sort((a, b) => a.year - b.year)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const change = last.employed_k - first.employed_k
    const direction = change >= 0 ? "increased" : "decreased"
    prompt += `Employment trend for this occupation (${first.year}–${last.year}): ${direction} from ${first.employed_k}k to ${last.employed_k}k workers`
    if (sorted.length > 2) {
      const mid = sorted[Math.floor(sorted.length / 2)]
      prompt += ` (${mid.year}: ${mid.employed_k}k)`
    }
    prompt += "\n\n"
  }

  // Skill gap
  if (skillGap) {
    const occupation = skillGap.occupation ?? selectedOccupation?.title ?? null
    if (occupation) prompt += `Skill gap check for: ${occupation}\n`

    // Shape 1: from SkillGapCheck component — { skillsHave: string[], skillsToBuild: string[] }
    if (skillGap.skillsHave != null || skillGap.skillsToBuild != null) {
      const have = skillGap.skillsHave ?? []
      const build = skillGap.skillsToBuild ?? []
      if (have.length > 0) {
        prompt += `Skills the student already has (${have.length}): ${have.slice(0, 10).join(", ")}\n`
      } else {
        prompt += `Skills the student already has: none selected yet\n`
      }
      if (build.length > 0) {
        prompt += `Skills the student still needs to build (${build.length}): ${build.slice(0, 10).join(", ")}\n`
      }
    }

    // Shape 2: from skills API — { matched: [], missing: [], match_percentage, total_required }
    if (skillGap.match_percentage != null) {
      prompt += `Skill match: student has ${skillGap.match_percentage}% of required skills (${skillGap.matched?.length ?? 0}/${skillGap.total_required ?? "?"} matched)\n`
    }
    if (skillGap.matched?.length > 0) {
      prompt += `Matched skills: ${skillGap.matched.slice(0, 8).map(s => s.skill_name ?? s).join(", ")}\n`
    }
    if (skillGap.missing?.length > 0) {
      prompt += `Missing skills: ${skillGap.missing.slice(0, 8).map(s => s.skill_name ?? s).join(", ")}\n`
    }
    // Legacy field names
    if (skillGap.matchedSkills?.length > 0 && !skillGap.matched) {
      prompt += `Matched skills: ${skillGap.matchedSkills.slice(0, 8).map(s => s.skill_name).join(", ")}\n`
    }
    if (skillGap.missingSkills?.length > 0 && !skillGap.missing) {
      prompt += `Missing skills: ${skillGap.missingSkills.slice(0, 8).map(s => s.skill_name).join(", ")}\n`
    }

    prompt += "\n"
  }

  // Region
  if (region) {
    prompt += `Student's selected region: ${region} (Australia)\n\n`
  }

  // Fallback when no profile data at all
  if (!matchedCareers.length && !selectedOccupation && !skillGap && !region && !interestCodes) {
    prompt += `The student has not yet completed the quiz or selected a career. Answer general career questions and encourage them to complete the RIASEC quiz for personalised advice.\n\n`
  }

  return prompt
}

export default router