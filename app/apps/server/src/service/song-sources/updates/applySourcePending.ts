import { readChangedSongs, saveChangedSongs } from './changedSongsStore'
import { importSourceSongs } from './importSourceSongs'
import { readLackingSongs, saveLackingSongs } from './lackingSongsStore'
import { toSongSet } from './songSyncNotifications'
import type { SourceSongChanges } from './types'
import { updateLibrarySongs } from './updateLibrarySongs'
import type { SongSource } from '../types'

/**
 * Syncs what a source's last check left waiting: adds its new songs and
 * brings the songs it changed up to date. A song changed here stays
 * waiting, as a new version the user may take; the songs the library has
 * under another title stay for Song discovery.
 */
export function applySourcePending(source: SongSource): SourceSongChanges {
  const lacking = readLackingSongs(source.id)
  const added = importSourceSongs(
    source,
    lacking.filter((song) => song.verdict === 'new'),
  )
  const changed = readChangedSongs(source.id)
  const updated = updateLibrarySongs(
    source.id,
    changed.filter((song) => !song.edited),
  )
  saveLackingSongs(
    source.id,
    lacking.filter((song) => song.verdict === 'similar'),
  )
  saveChangedSongs(
    source.id,
    changed.filter((song) => song.edited),
  )
  return {
    sourceId: source.id,
    name: source.name,
    added: toSongSet(added),
    updated: toSongSet(updated),
  }
}
