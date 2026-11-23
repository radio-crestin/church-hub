import { readChangedSongs, saveChangedSongs } from './changedSongsStore'
import { saveKeptSongs } from './keptSongsStore'
import { recountSourceSongs } from './recountSourceSongs'
import { recordSyncedNotification, toSongSet } from './songSyncNotifications'
import { updateLibrarySongs } from './updateLibrarySongs'
import { clearSearchCache } from '../../songs'
import { findSongSource } from '../listSongSources'

/**
 * The user's choice for some of the library songs a source changed:
 * `update` gives them the source's lyrics (never to a song edited by hand),
 * `keep` keeps the library's and does not offer this version again. Either
 * way they stop waiting. Returns how many songs were updated.
 */
export function resolveChangedSongs(
  sourceId: string,
  songIds: number[],
  action: 'update' | 'keep',
): number {
  const source = findSongSource(sourceId)
  const ids = new Set(songIds)
  const changed = readChangedSongs(sourceId)
  const picked = changed.filter((c) => ids.has(c.songId))
  let updated = 0
  if (action === 'update') {
    const songs = updateLibrarySongs(picked)
    updated = songs.length
    recordSyncedNotification(`songs-synced:${Date.now()}`, [
      {
        sourceId,
        name: source.name,
        added: toSongSet([]),
        updated: toSongSet(songs),
      },
    ])
    clearSearchCache()
  } else {
    saveKeptSongs(sourceId, picked)
  }
  saveChangedSongs(
    sourceId,
    changed.filter((c) => !ids.has(c.songId)),
  )
  recountSourceSongs(sourceId)
  return updated
}
