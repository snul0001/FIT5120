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
    region = null
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

  if (matchedCareers.length > 0) {
    prompt += `Student's top matched careers (from RIASEC quiz):\n`
    matchedCareers.slice(0, 5).forEach((c, i) => {
      prompt += `${i + 1}. ${c.title} — match score: ${c.match_score ?? "N/A"}, AI resilience: ${c.resilience_score ?? "N/A"}/100\n`
    })
    prompt += "\n"
  }

  if (selectedOccupation) {
    prompt += `Student is currently viewing: ${selectedOccupation.title}\n`
    if (selectedOccupation.resilience_score != null) {
      prompt += `AI resilience score: ${selectedOccupation.resilience_score}/100\n`
    }
    prompt += "\n"
  }

  if (skillGap) {
    if (skillGap.matchedSkills?.length > 0) {
      prompt += `Skills the student already has: ${skillGap.matchedSkills.slice(0, 5).map(s => s.skill_name).join(", ")}\n`
    }
    if (skillGap.missingSkills?.length > 0) {
      prompt += `Skills the student is missing: ${skillGap.missingSkills.slice(0, 5).map(s => `${s.skill_name} (importance: ${s.importance_score})`).join(", ")}\n`
    }
    prompt += "\n"
  }

  if (region) {
    prompt += `Student's selected region: ${region} (Australia)\n\n`
  }

  if (!matchedCareers.length && !selectedOccupation && !skillGap && !region) {
    prompt += `The student has not yet completed the quiz or selected a career. Answer general career questions and encourage them to complete the RIASEC quiz for personalised advice.\n\n`
  }

  return prompt
}

export default router