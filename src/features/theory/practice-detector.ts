import { SongNote } from '@/types'

export interface PracticeSegment {
  start: number
  end: number
}

/**
 * Asynchronously calculates a recommended practice loop segment for weak song parts.
 * Evaluates timing deviation, hold duration accuracy, relative error density,
 * mid-performance give-ups, and clamps segment length between 10% and 50% of song duration.
 */
export async function detectPracticeSegmentAsync(
  songNotes: SongNote[],
  songDuration: number,
  signal?: AbortSignal,
): Promise<PracticeSegment> {
  return new Promise((resolve, reject) => {
    // Yield to main thread via microtask/setTimeout so caller opens modal immediately without UI freeze
    const timer = setTimeout(() => {
      if (signal?.aborted) {
        return reject(new Error('Calculation cancelled'))
      }

      try {
        const result = detectPracticeSegment(songNotes, songDuration)
        if (signal?.aborted) {
          return reject(new Error('Calculation cancelled'))
        }
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }, 150)

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('Calculation cancelled'))
      })
    }
  })
}

/**
 * Core synchronous practice segment detection algorithm.
 */
export function detectPracticeSegment(
  songNotes: SongNote[],
  songDuration: number,
): PracticeSegment {
  if (!songDuration || songDuration <= 0) {
    return { start: 0, end: 0 }
  }

  const minDuration = songDuration * 0.1
  const maxDuration = songDuration * 0.5

  if (!songNotes || songNotes.length === 0) {
    return { start: 0, end: Math.min(songDuration, minDuration) }
  }

  // Sort notes by start timestamp
  const sortedNotes = [...songNotes].sort((a, b) => a.time - b.time)

  // 1. Calculate per-note error metrics
  let totalErrorSum = 0
  let dropOffTime: number | null = null
  let firstUnattemptedStreakIndex: number | null = null

  // Check for trailing give-up (drop-off point where player stops attempting notes)
  let unattemptedStreakCount = 0
  for (let i = 0; i < sortedNotes.length; i++) {
    const note = sortedNotes[i]
    const isAttempted = note.userPressStart !== undefined

    if (!isAttempted) {
      unattemptedStreakCount++
      if (unattemptedStreakCount >= 5 && firstUnattemptedStreakIndex === null) {
        firstUnattemptedStreakIndex = i - 5
      }
    } else {
      unattemptedStreakCount = 0
      firstUnattemptedStreakIndex = null
    }
  }

  if (firstUnattemptedStreakIndex !== null && firstUnattemptedStreakIndex >= 0) {
    dropOffTime = sortedNotes[firstUnattemptedStreakIndex].time
  }

  const noteScores = sortedNotes.map((note) => {
    const isAttempted = note.userPressStart !== undefined

    if (!isAttempted) {
      totalErrorSum += 1.0
      return { time: note.time, duration: note.duration, error: 1.0, isAttempted: false }
    }

    // Timing deviation error
    const timingDev = Math.abs(note.userPressStart! - note.time)
    const timingErr = Math.min(1.0, timingDev / 0.35)

    // Hold duration score error
    const durationErr = 1.0 - Math.min(1.0, Math.max(0, note.durationScore ?? 1.0))

    // Base error composite
    let error = 0.6 * timingErr + 0.4 * durationErr

    // Override / boost based on feedback color
    if (note.feedbackColor === 'red') {
      error = Math.max(error, 0.9)
    } else if (note.feedbackColor === 'yellow') {
      error = Math.max(error, 0.45)
    } else if (note.feedbackColor === 'green') {
      error = Math.min(error, 0.2)
    }

    totalErrorSum += error
    return { time: note.time, duration: note.duration, error, isAttempted: true }
  })

  // 2. Baseline song error density
  const songBaselineError = totalErrorSum / noteScores.length

  // 3. Sliding window failure detection
  const windowWidth = Math.max(4, songDuration * 0.08)
  const failureThreshold = Math.min(0.85, Math.max(songBaselineError + 0.12, 0.28))

  let firstFailureStart: number | null = null
  let failureEnd: number | null = null

  // Analyze sliding time windows across the song
  const step = 1.0 // 1-second steps
  for (let t = 0; t <= songDuration - windowWidth; t += step) {
    // Truncate window analysis if past give-up drop-off point
    if (dropOffTime !== null && t > dropOffTime + 2) {
      break
    }

    const windowNotes = noteScores.filter(
      (n) => n.time >= t && n.time < t + windowWidth,
    )

    if (windowNotes.length === 0) continue

    const windowErrorDensity =
      windowNotes.reduce((acc, n) => acc + n.error, 0) / windowNotes.length

    if (windowErrorDensity >= failureThreshold) {
      if (firstFailureStart === null) {
        firstFailureStart = t
      }
      failureEnd = t + windowWidth
    } else if (firstFailureStart !== null) {
      // Allow slight gap before terminating elevated segment
      if (t > (failureEnd ?? firstFailureStart) + 3) {
        break
      }
    }
  }

  // Handle mid-performance give-up truncation
  if (dropOffTime !== null) {
    if (firstFailureStart !== null && firstFailureStart < dropOffTime) {
      // Keep segment start, clamp end near drop-off point
      failureEnd = Math.min(failureEnd ?? dropOffTime, dropOffTime + 2)
    } else if (firstFailureStart === null || firstFailureStart >= dropOffTime) {
      // Find errors immediately preceding the drop-off
      const preDropNotes = noteScores.filter(
        (n) => n.time < dropOffTime && n.isAttempted && n.error > 0.3,
      )
      if (preDropNotes.length > 0) {
        firstFailureStart = Math.max(0, preDropNotes[0].time - 1)
        failureEnd = Math.min(songDuration, dropOffTime + 1)
      }
    }
  }

  // 4. High accuracy fallback if no sustained failure region found
  if (firstFailureStart === null) {
    let highestErrNote = noteScores[0]
    for (const n of noteScores) {
      if (n.error > highestErrNote.error) {
        highestErrNote = n
      }
    }

    const peakTime = highestErrNote ? highestErrNote.time : songDuration * 0.25
    let start = Math.max(0, peakTime - minDuration / 2)
    let end = Math.min(songDuration, start + minDuration)

    if (end - start < minDuration) {
      start = Math.max(0, end - minDuration)
    }

    return {
      start: Math.round(start * 100) / 100,
      end: Math.round(end * 100) / 100,
    }
  }

  // 5. Finalize & Clamp segment duration between 10% and 50%
  let rawStart = firstFailureStart
  let rawEnd = failureEnd ?? (rawStart + minDuration)
  let rawLength = rawEnd - rawStart

  if (rawLength < minDuration) {
    const pad = (minDuration - rawLength) / 2
    rawStart = Math.max(0, rawStart - pad)
    rawEnd = Math.min(songDuration, rawStart + minDuration)
    if (rawEnd - rawStart < minDuration) {
      rawStart = Math.max(0, rawEnd - minDuration)
    }
  } else if (rawLength > maxDuration) {
    rawEnd = rawStart + maxDuration
  }

  // Ensure within [0, songDuration]
  const finalStart = Math.max(0, Math.min(songDuration - minDuration, rawStart))
  const finalEnd = Math.min(songDuration, Math.max(finalStart + minDuration, rawEnd))

  return {
    start: Math.round(finalStart * 100) / 100,
    end: Math.round(finalEnd * 100) / 100,
  }
}
