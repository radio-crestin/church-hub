import { applySourcePending } from './applySourcePending'
import { recordSyncedNotification } from './songSyncNotifications'
import { getStoredSourceUpdates, saveSourceUpdates } from './sourceUpdatesStore'
import type { SourceSongChanges } from './types'
import { deleteNotificationsOfKind } from '../../notifications'
import { clearSearchCache } from '../../songs'
import { listSongSources } from '../listSongSources'

/**
 * The user's approval: syncs every source's waiting new songs and updates
 * (see applySourcePending). Returns what changed.
 */
export function syncPendingSongs(): SourceSongChanges[] {
  const sources = new Map(listSongSources().map((s) => [s.id, s]))
  const changes: SourceSongChanges[] = []
  const updates = getStoredSourceUpdates().map((update) => {
    const source = sources.get(update.sourceId)
    const waiting = update.newCount > 0 || update.changedCount > 0
    if (!source || !waiting) return update
    const synced = applySourcePending(source)
    changes.push(synced)
    return {
      ...update,
      newCount: 0,
      changedCount: 0,
      imported: synced.added.count,
      updated: synced.updated.count,
    }
  })
  saveSourceUpdates(updates)
  recordSyncedNotification(`songs-synced:${Date.now()}`, changes)
  deleteNotificationsOfKind('songs-pending')
  clearSearchCache()
  return changes
}
