import { captureSongSnapshot } from './captureSongSnapshot'
import { getSongHistoryEntry } from './getSongHistoryEntry'
import { recordSongEdit } from './recordSongEdit'
import type { SongEditor, SongSnapshot } from './types'
import { upsertSong } from '../songs/songs'
import type { SongWithSlides } from '../songs/types'

/** Which side of a history entry to put back: the song before or after it. */
export type RestoreSide = 'before' | 'after'

/**
 * Puts a song back to how it looked before or after a history entry. The
 * restore is itself a history entry, so it can be undone. Returns null when the
 * entry does not belong to the song or has no such side (a created song has no
 * "before").
 */
export function restoreSongVersion(
  songId: number,
  entryId: number,
  side: RestoreSide,
  editor: SongEditor,
): SongWithSlides | null {
  const entry = getSongHistoryEntry(songId, entryId)
  const target: SongSnapshot | null = entry ? entry[side] : null
  if (!target) return null

  const before = captureSongSnapshot(songId)
  const restored = upsertSong({
    id: songId,
    title: target.title,
    slides: target.slides,
    isManualEdit: true,
  })

  const after = captureSongSnapshot(songId)
  if (after) {
    recordSongEdit({
      songId,
      kind: 'restored',
      editor,
      before,
      after,
      restoredFromId: entryId,
    })
  }
  return restored
}
