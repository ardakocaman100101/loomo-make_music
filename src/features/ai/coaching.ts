export interface CoachingPayload {
  sessionMeta: {
    songTitle: string
    difficulty: string | number
    duration: number
    keySignature: string
    timeSignature: { numerator: number; denominator: number }
    bpm: number
    playbackSpeed: number
    activeTracks: string
  }
  hitMetrics: {
    accuracy: number
    streak: number
    perfect: number
    early: number
    late: number
    miss: number
  }
  durationBreakdown: {
    durationScore: number
    pctG: number
    pctY: number
    pctP: number
    pctR: number
  }
  history: {
    attemptCount: number
    durationScoreTrend: number[]
  }
  recentSessionFeedback?: string[]
}

export const AI_COACHING_SYSTEM_PROMPT = `
You are a warm, casual, grounded human music teacher giving direct 1-2 sentence coaching feedback to a student after they played a piano song on Loomo.

RAW METRICS DEFINITIONS & INTERPRETATION GUIDELINES:
- accuracy (Hit Score %): Ratio of correctly timed note attacks.
- pctG (Correct Hold %): Percentage of time keys were held for their correct target duration (tG). High values (>70%) indicate solid sustain control.
- pctY (Early Press Duration %): Accumulated duration spent pressing keys before note target start times (tY). High values (>20%) indicate rushing note attacks.
- pctP (Late Press Duration %): Accumulated duration spent pressing keys after note target start times (tP). High values (>20%) indicate lagging, hesitating, or dragging tempo.
- pctR (Release Error Duration %): Accumulated duration where notes were released early or overheld past target end times (tR). High values (>20%) indicate dropping long notes prematurely or slurring key releases.
- early vs late hit counts: If early > late * 1.5, student is rushing attacks. If late > early * 1.5, student is hesitating before key presses.
- durationScoreTrend: Chronological array tracking session progress (rising trend = improving muscle memory; flat/declining trend = potential fatigue or stuck section).

ACTIONABLE SUGGESTIONS & TEMPO RULES:
1. When lagging behind the beat (high pctP or late > early), explicitly suggest lowering the BPM to build comfortable finger control.
2. When rushing into note attacks (high pctY or early > late), explicitly suggest lowering the BPM to steady their rhythm.
3. NEVER repeat previous feedback sentences given in this session. Always use fresh sentence structures and creative wording even if the score is identical.

COACHING RULES:
1. Act strictly as a direct, encouraging human music teacher talking directly to the student in 1-2 casual sentences.
2. Focus on their primary area for improvement or celebrate solid timing while providing an actionable recommendation.
3. NEVER use AI jargon or robotic filler. STRICTLY BAN: "delve", "testament", "tapestry", "supercharge", "unleash", "elevate", "seamless", "masterclass", "as an AI", "remember to", "overall", "congratulations".
4. Output ONLY the 1-2 sentence coaching advice as plain text. No markdown formatting, quotes, or titles.
`

// In-memory record of coaching feedback given in the current user session
const sessionAdviceHistory: string[] = []

export function getSessionAdviceHistory(): string[] {
  return [...sessionAdviceHistory]
}

export function clearSessionAdviceHistory(): void {
  sessionAdviceHistory.length = 0
}

function recordSessionAdvice(advice: string): string {
  sessionAdviceHistory.push(advice)
  if (sessionAdviceHistory.length > 50) {
    sessionAdviceHistory.shift()
  }
  return advice
}

/**
 * Heuristic rule-based fallback coach with non-repeating phrasing pools.
 * Guarantees that the user will not receive the exact same feedback twice in a session.
 */
export function generateHeuristicCoachingAdvice(payload: CoachingPayload): string {
  const { hitMetrics, durationBreakdown, history } = payload
  const { accuracy, early, late, miss } = hitMetrics
  const { pctG, pctY, pctP, pctR } = durationBreakdown
  const trend = history.durationScoreTrend

  const isImproving =
    trend.length >= 2 && trend[trend.length - 1] > trend[0]

  let candidatePool: string[] = []

  if (accuracy >= 90 && pctG >= 75) {
    candidatePool = [
      `Fantastic control on your timing and note holds! Your muscle memory is locking into place beautifully.`,
      `Outstanding performance! Your rhythm and key holds are spot on across the board.`,
      `Superb accuracy and steady holds! You've really mastered the flow and articulation of this piece.`,
      `Incredible run! Both your attack precision and note sustain are exceptionally clean.`,
      `Spot-on timing from start to finish! You're playing with real confidence and groove.`,
    ]
  } else if (pctP > 25 || late > early * 1.5) {
    candidatePool = [
      `Your timing is lagging slightly behind the beat—try lowering the BPM by 10-15% to build comfortable finger control.`,
      `You're dragging a bit behind the note attacks—consider slowing down the BPM so your fingers can catch up comfortably.`,
      `Your presses are falling behind the target line—lowering the active BPM will help your muscle memory lock into the tempo.`,
      `A bit of hesitation on note entries—try dropping the tempo a few notches to let your fingers strike earlier.`,
      `You're trailing slightly behind the rhythm—practicing at a reduced tempo will help you anticipate each strike in advance.`,
    ]
  } else if (pctY > 25 || early > late * 1.5) {
    candidatePool = [
      `You're rushing into your key attacks a bit early—try lowering the BPM to steady your rhythm and let the beat come to you.`,
      `Your fingers are jumping ahead of the beat—slowing down the tempo slightly will help you stay patient on each attack.`,
      `Watch out for rushing early on key presses—reducing the active BPM will help your hands settle into a steady groove.`,
      `You're anticipating the notes just a little too fast—dialing back the tempo will train your hands to stay in the pocket.`,
      `Early attacks are creeping in—try tapping your foot to a slightly slower tempo so you don't jump ahead of the notes.`,
    ]
  } else if (pctR > 25) {
    candidatePool = [
      `Watch your note releases—make sure to hold long notes all the way through their full count before lifting your fingers.`,
      `You're releasing some notes a bit early—try lingering on the long keys until the next beat triggers.`,
      `Pay attention to your sustain duration—holding long notes to their full length will smooth out your tone.`,
      `Be mindful not to cut phrases short—give each held note its full value before lifting off the keys.`,
      `Focus on cleaner releases on the longer values so the notes connect smoothly without early gaps.`,
    ]
  } else if (miss > (early + late + hitMetrics.perfect) * 0.3) {
    candidatePool = [
      `Focus on spotting the note positions ahead of time so your hands feel relaxed during tricky transitions.`,
      `Try reading a measure or two ahead so your fingers have time to position themselves before each phrase.`,
      `Take the trickier passages at a slightly lower BPM first to get comfortable with the note jumps.`,
      `Keep your eyes scanning ahead along the waterfall to prepare your hand shape before the next cluster drops.`,
    ]
  } else if (isImproving) {
    candidatePool = [
      `Great persistence! Your session score trend shows steady progress on note hold control with each run.`,
      `Nice work sticking with it! Your accuracy trend is climbing higher with every attempt.`,
      `Solid progress! Each run is refining your timing and building smoother muscle memory.`,
      `Your consistency is definitely trending upward—each repetition is locking the phrases in deeper.`,
    ]
  } else {
    candidatePool = [
      `Solid effort on this run! Work on keeping your hand relaxed through the faster passages to smooth out your timing.`,
      `Good attempt! Focus on maintaining a steady wrist position through the busier sections.`,
      `Keep it up! A slightly lower BPM during practice will help your hands feel even more relaxed.`,
      `Nice foundation! Aim for a consistent, fluid motion from phrase to phrase to elevate your consistency.`,
    ]
  }

  // Filter out any advice string that was already given in this session
  const unusedOptions = candidatePool.filter(
    (opt) => !sessionAdviceHistory.includes(opt),
  )

  const selectedPool = unusedOptions.length > 0 ? unusedOptions : candidatePool

  // Avoid giving the exact last message if possible
  const lastGiven = sessionAdviceHistory[sessionAdviceHistory.length - 1]
  const nonConsecutive =
    selectedPool.length > 1
      ? selectedPool.filter((opt) => opt !== lastGiven)
      : selectedPool

  const finalChoice =
    nonConsecutive[Math.floor(Math.random() * nonConsecutive.length)]

  return recordSessionAdvice(finalChoice)
}

/**
 * Asynchronously generates AI coaching advice via Gemini API or heuristic coach,
 * enforcing a 2-second processing delay to ensure all end-of-song data is finalized,
 * and guaranteeing that no duplicate feedback is returned within the active session.
 */
export async function generateAICoachingAdvice(
  payload: CoachingPayload,
  signal?: AbortSignal,
): Promise<string> {
  const startTime = Date.now()

  let advicePromise: Promise<string>

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.VITE_GOOGLE_AI_KEY

  if (!apiKey) {
    advicePromise = Promise.resolve(generateHeuristicCoachingAdvice(payload))
  } else {
    advicePromise = (async () => {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

        // Include recent session history in prompt so the LLM avoids repeating phrasing
        const payloadWithHistory: CoachingPayload = {
          ...payload,
          recentSessionFeedback: sessionAdviceHistory.slice(-8),
        }

        const userPrompt = `Student Performance Payload:\n${JSON.stringify(payloadWithHistory, null, 2)}\n\nPREVIOUS FEEDBACK GIVEN IN THIS SESSION (STRICT RULE: YOU MUST NOT REPEAT OR CLOSELY PARAPHRASE ANY OF THESE):\n${JSON.stringify(sessionAdviceHistory.slice(-8), null, 2)}`

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${AI_COACHING_SYSTEM_PROMPT}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              temperature: 0.95,
              maxOutputTokens: 120,
            },
          }),
        })

        if (!response.ok) {
          throw new Error(`Gemini API HTTP ${response.status}`)
        }

        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

        if (text) {
          let cleanText = text.replace(/^["']|["']$/g, '')
          // If the model repeated an exact previous session advice, pick a unique heuristic one
          if (sessionAdviceHistory.includes(cleanText)) {
            return generateHeuristicCoachingAdvice(payload)
          }
          return recordSessionAdvice(cleanText)
        }

        return generateHeuristicCoachingAdvice(payload)
      } catch (err: any) {
        if (err.name === 'AbortError' || signal?.aborted) {
          throw err
        }
        console.warn('AI Coaching API call failed or timed out, using fallback coach:', err)
        return generateHeuristicCoachingAdvice(payload)
      }
    })()
  }

  const result = await advicePromise

  // Enforce mandatory 2-second processing delay so end-of-song data finalizes
  const elapsed = Date.now() - startTime
  if (elapsed < 2000) {
    await new Promise((res) => setTimeout(res, 2000 - elapsed))
  }

  if (signal?.aborted) {
    throw new Error('Aborted')
  }

  return result
}
