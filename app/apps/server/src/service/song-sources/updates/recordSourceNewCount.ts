import { getStoredSourceUpdates, saveSourceUpdates } from './sourceUpdatesStore'
import { findSongSource } from '../listSongSources'

/**
 * Song discovery's own count of a source's new songs, fresher than the last
 * check once the user imported some: it keeps the notification right.
 */
export function recordSourceNewCount(sourceId: string, newCount: number): void {
  const source = findSongSource(sourceId)
  const updates = getStoredSourceUpdates()
  const existing = updates.find((u) => u.sourceId === sourceId)
  const next = {
    sourceId,
    name: source.name,
    checksum: existing?.checksum ?? '',
    imported: existing?.imported ?? 0,
    checkedAt: existing?.checkedAt ?? Date.now(),
    newCount,
  }
  saveSourceUpdates([...updates.filter((u) => u.sourceId !== sourceId), next])
}
