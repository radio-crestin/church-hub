import type { ChangedSong } from './findChangedSongs'
import { readSourceCache, writeSourceCache } from './sourceCacheFile'

/**
 * Keeps the library songs a source changed while syncing without approval
 * is off, until the user syncs them.
 */
export function saveChangedSongs(sourceId: string, songs: ChangedSong[]): void {
  writeSourceCache('changed', sourceId, songs)
}

export function readChangedSongs(sourceId: string): ChangedSong[] {
  return readSourceCache<ChangedSong>('changed', sourceId)
}
