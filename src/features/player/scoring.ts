import type { SongNote } from '@/types'

export type FeedbackColor = 'green' | 'yellow' | 'purple' | 'red' | 'grey'

export interface NoteScoreResult {
  color: FeedbackColor
  category: 'perfect' | 'early' | 'late' | 'error'
  tY: number // Early (Yellow) duration: max(0, tS - t1)
  tP: number // Late (Purple) duration: max(0, t1 - tS)
}

export interface SessionScoreRecord {
  id: string
  songId: string
  songTitle?: string
  timestamp: number
  perfect: number
  early: number
  late: number
  missed: number
  error: number
  accuracy: number
  averageDurationScore: number
  streakMax: number
}

/**
 * Calculates continuous duration score D.score per note:
 * tS = note.time (target start)
 * tE = note.time + note.duration (target end)
 * t1 = note.userPressStart (user press start)
 * t2 = note.userPressEnd ?? fallbackReleaseTime (user release time)
 *
 * tY = max(0, tS - t1)  (early / yellow press duration)
 * tP = max(0, t1 - tS)  (late / purple press duration)
 * tR = |t2 - tE|        (release error duration)
 * tG = max(0, min(t2, tE) - max(t1, tS)) (correct overlapping duration)
 *
 * D.score = tG / (tY + tP + tR + tG)
 */
export function calculateNoteDurationScore(
  note: SongNote,
  fallbackReleaseTime?: number,
): number {
  if (note.userPressStart === undefined) {
    return 0
  }

  const tS = note.time
  const tE = note.time + note.duration
  const t1 = note.userPressStart
  const t2 = note.userPressEnd ?? fallbackReleaseTime ?? (note.time + note.duration)

  // tY: Early (Yellow) press duration before note start: positive when pressed early
  const tY = Math.max(0, tS - t1)

  // tP: Late (Purple) press duration after note start: positive when pressed late
  const tP = Math.max(0, t1 - tS)

  // tR: Release error duration
  const tR = Math.abs(t2 - tE)

  // tG: Correct overlapping duration
  const tG = Math.max(0, Math.min(t2, tE) - Math.max(t1, tS))

  const denominator = tY + tP + tR + tG
  if (denominator <= 0) {
    return 0
  }

  const score = tG / denominator
  return Number.isNaN(score) ? 0 : score
}

/**
 * Evaluates first-time key press timing and assigns category & color.
 * If press is early (t1 < tS), tY > 0 -> Yellow.
 * If press is late (t1 > tS), tP > 0 -> Purple.
 * If press is within perfectRange, tY/tP close to 0 -> Green.
 */
export function evaluateFirstPressScore(
  targetTimeSec: number,
  pressTimeSec: number,
  perfectRangeMs: number,
): NoteScoreResult {
  const diffMs = (targetTimeSec - pressTimeSec) * 1000
  const absDiffMs = Math.abs(diffMs)

  const tY = Math.max(0, targetTimeSec - pressTimeSec)
  const tP = Math.max(0, pressTimeSec - targetTimeSec)

  if (absDiffMs <= perfectRangeMs) {
    return { color: 'green', category: 'perfect', tY, tP }
  }

  // Early press (pressTime < targetTime): tY > 0 -> Yellow
  if (diffMs > 0) {
    return { color: 'yellow', category: 'early', tY, tP }
  }

  // Late press (pressTime > targetTime): tP > 0 -> Purple
  return { color: 'purple', category: 'late', tY, tP }
}

const SCORE_HISTORY_STORAGE_KEY = 'loomo_session_score_history'
const RECORD_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days (1 week)

/**
 * Session score history store for songs played.
 * Persists to localStorage across page refreshes, automatically expiring records older than 7 days.
 */
class SessionScoreHistoryStore {
  private historyMap: Map<string, SessionScoreRecord[]> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return
      const raw = localStorage.getItem(SCORE_HISTORY_STORAGE_KEY)
      if (!raw) return

      const parsed: Record<string, SessionScoreRecord[]> = JSON.parse(raw)
      const now = Date.now()
      let hasChanges = false

      for (const [songId, records] of Object.entries(parsed)) {
        const validRecords = records.filter(
          (r) => now - r.timestamp < RECORD_EXPIRATION_MS,
        )
        if (validRecords.length !== records.length) {
          hasChanges = true
        }
        if (validRecords.length > 0) {
          this.historyMap.set(songId, validRecords)
        }
      }

      if (hasChanges) {
        this.saveToStorage()
      }
    } catch (e) {
      console.warn('Failed to load score history from storage', e)
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return
      const obj: Record<string, SessionScoreRecord[]> = {}
      for (const [songId, list] of this.historyMap.entries()) {
        obj[songId] = list
      }
      localStorage.setItem(SCORE_HISTORY_STORAGE_KEY, JSON.stringify(obj))
    } catch (e) {
      console.warn('Failed to save score history to storage', e)
    }
  }

  addRecord(record: SessionScoreRecord): void {
    const list = this.historyMap.get(record.songId) || []
    list.push(record)
    this.historyMap.set(record.songId, list)
    this.saveToStorage()
  }

  getRecordsForSong(songId: string): SessionScoreRecord[] {
    const now = Date.now()
    const list = this.historyMap.get(songId) || []
    return list.filter((r) => now - r.timestamp < RECORD_EXPIRATION_MS)
  }

  getAllRecords(): SessionScoreRecord[] {
    const now = Date.now()
    const all: SessionScoreRecord[] = []
    for (const list of this.historyMap.values()) {
      all.push(...list.filter((r) => now - r.timestamp < RECORD_EXPIRATION_MS))
    }
    return all.sort((a, b) => b.timestamp - a.timestamp)
  }

  clearHistory(songId?: string): void {
    if (songId) {
      this.historyMap.delete(songId)
    } else {
      this.historyMap.clear()
    }
    this.saveToStorage()
  }
}

export const sessionScoreHistory = new SessionScoreHistoryStore()
