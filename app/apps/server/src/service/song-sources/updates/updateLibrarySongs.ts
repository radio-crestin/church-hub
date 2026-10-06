import type { ChangedSong } from './findChangedSongs'
import type { SongRef } from './types'
import { getRawDatabase } from '../../../db'
import { batchUpdateSearchIndex, upsertSong } from '../../songs'

/** Whether the library still has the song, never edited by hand. */
function isUntouched(songId: number): boolean {
  const row = getRawDatabase()
    .query('SELECT last_manual_edit FROM songs WHERE id = ?')
    .get(songId) as { last_manual_edit: number | null } | null
  return row !== null && !row.last_manual_edit
}

/**
 * Gives library songs the source's newer lyrics. Only the slides change:
 * title, category, alternate titles and the rest stay, and the song is not
 * marked as edited by hand. A song edited by hand since the check is left
 * alone. Returns the songs updated.
 */
export function updateLibrarySongs(changed: ChangedSong[]): SongRef[] {
  const updated: SongRef[] = []
  for (const { songId, song } of changed) {
    if (!isUntouched(songId)) continue
    const saved = upsertSong({
      id: songId,
      title: song.parsed.title,
      slides: song.parsed.slides.map((slide, index) => ({
        content: slide.htmlContent,
        sortOrder: index,
        label: slide.label ?? null,
      })),
    })
    if (saved) updated.push({ id: songId, title: song.parsed.title })
  }
  batchUpdateSearchIndex(updated.map((song) => song.id as number))
  return updated
}
