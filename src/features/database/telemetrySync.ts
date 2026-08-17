import * as idb from 'idb-keyval'
import { PracticeSessionPayload } from './types'

const OFFLINE_QUEUE_KEY = 'LOOMO_OFFLINE_PRACTICE_TELEMETRY'

export class TelemetrySyncService {
  /**
   * Enqueue a practice session to IndexedDB with zero audio/render thread latency.
   */
  static async enqueueSession(payload: PracticeSessionPayload): Promise<void> {
    try {
      const queue = (await idb.get<PracticeSessionPayload[]>(OFFLINE_QUEUE_KEY)) || []
      queue.push(payload)
      await idb.set(OFFLINE_QUEUE_KEY, queue)
    } catch (err) {
      console.warn('[TelemetrySync] Failed queueing session to IndexedDB:', err)
    }
  }

  /**
   * Retrieve all pending queued sessions from IndexedDB.
   */
  static async getPendingSessions(): Promise<PracticeSessionPayload[]> {
    try {
      return (await idb.get<PracticeSessionPayload[]>(OFFLINE_QUEUE_KEY)) || []
    } catch (err) {
      console.warn('[TelemetrySync] Failed reading queued telemetry:', err)
      return []
    }
  }

  /**
   * Clear or filter out synced sessions from the offline queue.
   */
  static async clearSyncedSessions(syncedIds: string[]): Promise<void> {
    try {
      const queue = (await idb.get<PracticeSessionPayload[]>(OFFLINE_QUEUE_KEY)) || []
      const remaining = queue.filter((p) => !syncedIds.includes(p.session.id))
      await idb.set(OFFLINE_QUEUE_KEY, remaining)
    } catch (err) {
      console.warn('[TelemetrySync] Failed updating offline queue:', err)
    }
  }

  /**
   * Attempt flushing the offline queue to PostgreSQL via API/endpoint.
   */
  static async flushQueue(apiEndpoint = '/api/telemetry/sync'): Promise<{ syncedCount: number; errors: any[] }> {
    const queue = await this.getPendingSessions()
    if (queue.length === 0) {
      return { syncedCount: 0, errors: [] }
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: queue }),
      })

      if (response.ok) {
        const syncedIds = queue.map((q) => q.session.id)
        await this.clearSyncedSessions(syncedIds)
        return { syncedCount: syncedIds.length, errors: [] }
      } else {
        return { syncedCount: 0, errors: [await response.text()] }
      }
    } catch (err) {
      // Offline or server not reached - keep queued in IndexedDB
      return { syncedCount: 0, errors: [err] }
    }
  }
}
