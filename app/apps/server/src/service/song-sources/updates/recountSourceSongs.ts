import { readChangedSongs } from './changedSongsStore'
import { readLackingSongs } from './lackingSongsStore'
import { refreshPendingNotification } from './songSyncNotifications'
import { getStoredSourceUpdates, saveSourceUpdates } from './sourceUpdatesStore'
import { findSongSource } from '../listSongSources'

/**
 * Counts a source's waiting songs again, after the user imported some in
 * Song discovery, so the counts and the notification stay right.
 */
export function recountSourceSongs(sourceId: string): void {
  findSongSource(sourceId)
  const lacking = readLackingSongs(sourceId)
  const fresh = lacking.filter((song) => song.verdict === 'new').length
  const updates = getStoredSourceUpdates().map((update) =>
    update.sourceId === sourceId
      ? {
          ...update,
          newCount: fresh,
          similarCount: lacking.length - fresh,
          changedCount: readChangedSongs(sourceId).length,
        }
      : update,
  )
  saveSourceUpdates(updates)
  refreshPendingNotification()
}
