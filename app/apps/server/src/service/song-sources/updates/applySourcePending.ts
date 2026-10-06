import { readChangedSongs, saveChangedSongs } from './changedSongsStore'
import { importSourceSongs } from './importSourceSongs'
import { readLackingSongs, saveLackingSongs } from './lackingSongsStore'
import { toSongSet } from './songSyncNotifications'
import type { SourceSongChanges } from './types'
import { updateLibrarySongs } from './updateLibrarySongs'
import type { SongSource } from '../types'

/**
 * Syncs what a source's last check left waiting: adds its new songs and
 * brings the songs it changed up to date (never one edited by hand). The
 * songs the library has under another title stay for Song discovery.
 */
export function applySourcePending(source: SongSource): SourceSongChanges {
  const lacking = readLackingSongs(source.id)
  const added = importSourceSongs(
    source,
    lacking.filter((song) => song.verdict === 'new'),
  )
  const updated = updateLibrarySongs(readChangedSongs(source.id))
  saveLackingSongs(
    source.id,
    lacking.filter((song) => song.verdict === 'similar'),
  )
  saveChangedSongs(source.id, [])
  return {
    sourceId: source.id,
    name: source.name,
    added: toSongSet(added),
    updated: toSongSet(updated),
  }
}
