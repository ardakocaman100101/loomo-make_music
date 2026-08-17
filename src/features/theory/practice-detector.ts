import { SongNote } from '@/types'

export interface PracticeSegment {
  start: number
  end: number
}

/**
 * Asynchronously calculates a recommended practice loop segment for weak song parts.
 * Evaluates timing deviation, hold duration accuracy, relative error density,
 * mid-performance give-ups, and clamps segment length between 10% and 35% of song duration.
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
  const maxDuration = songDuration * 0.35

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

    return snapToMusicalBoundaries(start, end, sortedNotes, songDuration, minDuration, maxDuration)
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

  return snapToMusicalBoundaries(rawStart, rawEnd, sortedNotes, songDuration, minDuration, maxDuration)
}

/**
 * Snaps raw time interval [rawStart, rawEnd] to musical sequence boundaries (note attack & release)
 * while strictly maintaining length constraints [minDuration, maxDuration].
 *
 * Formula:
 * 1. Start Attack Snap:
 *    t_start = min(n.time) for all n where (n.time <= rawStart < n.time + n.duration)
 *              or next note attack if rawStart falls in silence.
 * 2. End Release Snap:
 *    t_end   = max(n.time + n.duration) for all n where (n.time < rawEnd and n.time + n.duration >= rawEnd)
 * 3. Range Constraint:
 *    minDuration <= (t_end - t_start) <= maxDuration
 */
function snapToMusicalBoundaries(
  rawStart: number,
  rawEnd: number,
  sortedNotes: SongNote[],
  songDuration: number,
  minDuration: number,
  maxDuration: number,
): PracticeSegment {
  if (sortedNotes.length === 0) {
    return {
      start: Math.round(rawStart * 100) / 100,
      end: Math.round(rawEnd * 100) / 100,
    }
  }

  // 1. Snap Start to note attack
  let snappedStart = rawStart
  const overlappingStartNotes = sortedNotes.filter(
    (n) => n.time <= rawStart && rawStart < n.time + n.duration,
  )

  if (overlappingStartNotes.length > 0) {
    // If inside a sounding note/chord, snap to its initial attack timestamp
    snappedStart = Math.min(...overlappingStartNotes.map((n) => n.time))
  } else {
    // If in silence, snap to the next upcoming note's attack
    const nextNote = sortedNotes.find((n) => n.time >= rawStart)
    if (nextNote) {
      snappedStart = nextNote.time
    }
  }

  // 2. Snap End to complete note duration (never cut mid-sustain)
  let snappedEnd = rawEnd
  const overlappingEndNotes = sortedNotes.filter(
    (n) => n.time < rawEnd && n.time + n.duration >= rawEnd,
  )

  if (overlappingEndNotes.length > 0) {
    snappedEnd = Math.max(...overlappingEndNotes.map((n) => n.time + n.duration))
  } else {
    // If in silence, find the completion time of the preceding sounding note
    const precedingNotes = sortedNotes.filter((n) => n.time < rawEnd)
    if (precedingNotes.length > 0) {
      const maxPrecedingEnd = Math.max(
        ...precedingNotes.map((n) => n.time + n.duration),
      )
      if (maxPrecedingEnd > snappedStart) {
        snappedEnd = maxPrecedingEnd
      }
    }
  }

  // 3. Enforce min/max duration constraints with musical note alignment
  let length = snappedEnd - snappedStart

  if (length < minDuration) {
    // Extend end to include full subsequent notes until minDuration is satisfied
    const extendedNote = sortedNotes.find(
      (n) => n.time + n.duration >= snappedStart + minDuration,
    )
    if (extendedNote) {
      snappedEnd = Math.min(songDuration, extendedNote.time + extendedNote.duration)
    } else {
      snappedEnd = Math.min(songDuration, snappedStart + minDuration)
    }

    length = snappedEnd - snappedStart
    if (length < minDuration) {
      // If at the end of the song, push start backward to earlier note attacks
      const earlierNote = [...sortedNotes]
        .reverse()
        .find((n) => n.time <= snappedEnd - minDuration)
      snappedStart = earlierNote ? earlierNote.time : Math.max(0, snappedEnd - minDuration)
    }
  } else if (length > maxDuration) {
    // Contract end to the latest note completing within maxDuration
    const notesInMax = sortedNotes.filter(
      (n) => n.time >= snappedStart && n.time + n.duration <= snappedStart + maxDuration,
    )
    if (notesInMax.length > 0) {
      snappedEnd = Math.max(...notesInMax.map((n) => n.time + n.duration))
    } else {
      snappedEnd = snappedStart + maxDuration
    }
  }

  // Bound safety
  const finalStart = Math.max(0, Math.min(songDuration, snappedStart))
  const finalEnd = Math.max(finalStart, Math.min(songDuration, snappedEnd))

  return {
    start: Math.round(finalStart * 100) / 100,
    end: Math.round(finalEnd * 100) / 100,
  }
}
