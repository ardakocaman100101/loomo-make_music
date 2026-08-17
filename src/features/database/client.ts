import { TelemetrySyncService } from './telemetrySync'
import {
  DbDurationMetrics,
  DbHitMetrics,
  DbPracticeSession,
  DbSong,
  DbSongTag,
  DbSongTrack,
  PracticeSessionPayload,
} from './types'

export * from './telemetrySync'
export * from './types'

/**
 * Record a practice session snapshot locally in IndexedDB and attempt background sync.
 */
export async function recordPracticeSession(
  songId: string,
  metrics: {
    perfect: number
    early: number
    late: number
    missed: number
    error: number
    durationHeld: number
    averageDurationScore: number
    accuracy: number
    streakMax: number
    totalScore?: number
  },
  songMeta?: { title: string; artist?: string; tags?: string[] },
): Promise<PracticeSessionPayload> {
  const sessionId = `${songId}_${Date.now()}`
  const timestamp = Date.now()

  const session: DbPracticeSession = {
    id: sessionId,
    song_id: songId,
    timestamp,
    total_score: metrics.totalScore || 0,
    accuracy: metrics.accuracy,
    streak_max: metrics.streakMax,
  }

  const hitMetrics: DbHitMetrics = {
    session_id: sessionId,
    perfect: metrics.perfect,
    early: metrics.early,
    late: metrics.late,
    missed: metrics.missed,
    error: metrics.error,
  }

  const durationMetrics: DbDurationMetrics = {
    session_id: sessionId,
    duration_held: metrics.durationHeld,
    average_duration_score: metrics.averageDurationScore,
  }

  const payload: PracticeSessionPayload = {
    session,
    hitMetrics,
    durationMetrics,
    songDetails: songMeta,
  }

  // Queue to IndexedDB (zero audio latency guarantee)
  await TelemetrySyncService.enqueueSession(payload)

  // Try background flush non-blockingly if browser is online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    TelemetrySyncService.flushQueue().catch(() => {})
  }

  return payload
}
