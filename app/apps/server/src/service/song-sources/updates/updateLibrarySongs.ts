import type { ChangedSong } from './findChangedSongs'
import { batchUpdateSearchIndex, upsertSong } from '../../songs'

/**
 * Gives library songs the source's newer lyrics. Only the slides change:
 * title, category, alternate titles and the rest stay, and the song is not
 * marked as edited by hand. Returns how many were updated.
 */
export function updateLibrarySongs(changed: ChangedSong[]): number {
  const ids: number[] = []
  for (const { songId, song } of changed) {
    const saved = upsertSong({
      id: songId,
      title: song.parsed.title,
      slides: song.parsed.slides.map((slide, index) => ({
        content: slide.htmlContent,
        sortOrder: index,
        label: slide.label ?? null,
      })),
    })
    if (saved) ids.push(songId)
  }
  batchUpdateSearchIndex(ids)
  return ids.length
}
