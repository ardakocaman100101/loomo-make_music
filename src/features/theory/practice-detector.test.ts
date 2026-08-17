// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { SongNote } from '@/types'
import { detectPracticeSegment } from './practice-detector'

describe('detectPracticeSegment (LOOMO-9)', () => {
  test('TC-01: Sustained Middle Failure Section', () => {
    const songDuration = 60
    const notes: SongNote[] = []

    // Notes 1-8 (t=2..18s): perfect
    for (let i = 0; i < 8; i++) {
      const t = 2 + i * 2
      notes.push({
        type: 'note',
        midiNote: 60,
        track: 0,
        measure: 1,
        time: t,
        duration: 1,
        userPressStart: t + 0.02,
        feedbackColor: 'green',
      })
    }

    // Notes 9-14 (t=22..32s): off-rhythm red errors
    for (let i = 0; i < 6; i++) {
      const t = 22 + i * 2
      notes.push({
        type: 'note',
        midiNote: 60,
        track: 0,
        measure: 1,
        time: t,
        duration: 1,
        userPressStart: t + 0.28,
        durationScore: 0.3,
        feedbackColor: 'red',
      })
    }

    // Notes 15-20 (t=36..55s): perfect
    for (let i = 0; i < 6; i++) {
      const t = 36 + i * 3
      notes.push({
        type: 'note',
        midiNote: 60,
        track: 0,
        measure: 1,
        time: t,
        duration: 1,
        userPressStart: t + 0.02,
        feedbackColor: 'green',
      })
    }

    const segment = detectPracticeSegment(notes, songDuration)
    expect(segment.start).toBeGreaterThanOrEqual(18)
    expect(segment.start).toBeLessThanOrEqual(23)
    expect(segment.end - segment.start).toBeGreaterThanOrEqual(6) // 10% min
    expect(segment.end - segment.start).toBeLessThanOrEqual(30) // 50% max
  })

  test('TC-02: Mid-Performance Drop-Off (Give-Up)', () => {
    const songDuration = 50
    const notes: SongNote[] = []

    // Notes t=5..18s attempted with errors
    for (let i = 0; i < 5; i++) {
      const t = 5 + i * 3
      notes.push({
        type: 'note',
        midiNote: 60,
        track: 0,
        measure: 1,
        time: t,
        duration: 1,
        userPressStart: t + 0.18,
        durationScore: 0.4,
        feedbackColor: 'yellow',
      })
    }

    // Notes t>=20s unattempted (5+ streak)
    for (let i = 0; i < 8; i++) {
      const t = 20 + i * 3
      notes.push({
        type: 'note',
        midiNote: 60,
        track: 0,
        measure: 1,
        time: t,
        duration: 1,
      })
    }

    const segment = detectPracticeSegment(notes, songDuration)
    expect(segment.start).toBeLessThan(20)
    expect(segment.end).toBeLessThanOrEqual(22)
  })

  test('TC-03: High Accuracy (Isolated Peak)', () => {
    const songDuration = 40
    const notes: SongNote[] = []

    for (let i = 0; i < 15; i++) {
      const t = 2 + i * 2.4
      if (i === 7) {
        // Isolated yellow error at t=18.8s
        notes.push({
          type: 'note',
          midiNote: 60,
          track: 0,
          measure: 1,
          time: t,
          duration: 1,
          userPressStart: t + 0.16,
          durationScore: 0.35,
          feedbackColor: 'yellow',
        })
      } else {
        notes.push({
          type: 'note',
          midiNote: 60,
          track: 0,
          measure: 1,
          time: t,
          duration: 1,
          userPressStart: t + 0.01,
          feedbackColor: 'green',
        })
      }
    }

    const segment = detectPracticeSegment(notes, songDuration)
    expect(segment.end - segment.start).toBeGreaterThanOrEqual(4.0) // min 10% duration for 40s song
    expect(segment.end - segment.start).toBeLessThanOrEqual(14.0) // max 35% duration for 40s song
    expect(segment.start).toBeLessThanOrEqual(18.8)
    expect(segment.end).toBeGreaterThanOrEqual(18.8)
  })

  test('TC-04: Sustained Wide Failure Section (35% Clamping)', () => {
    const songDuration = 80
    const notes: SongNote[] = []

    // Continuous errors from t=10s to t=65s (55s span)
    for (let i = 0; i < 25; i++) {
      const t = 10 + i * 2.2
      notes.push({
        type: 'note',
        midiNote: 60,
        track: 0,
        measure: 1,
        time: t,
        duration: 1,
        userPressStart: t + 0.32,
        durationScore: 0.2,
        feedbackColor: 'red',
      })
    }

    const segment = detectPracticeSegment(notes, songDuration)
    expect(segment.end - segment.start).toBeGreaterThanOrEqual(8.0) // min 10%
    expect(segment.end - segment.start).toBeLessThanOrEqual(28.0) // max 35% clamped (80 * 0.35 = 28s)
  })
})
