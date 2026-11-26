import type { ChangedSong } from './findChangedSongs'
import { isUntouched, readSongSourceState } from './readSongSourceState'
import type { SongRef } from './types'
import { getRawDatabase } from '../../../db'
import {
  batchUpdateSearchIndex,
  fillContentHashes,
  linkSourceSongs,
  type SourceLink,
  upsertSong,
} from '../../songs'

/**
 * Gives library songs the source's newer lyrics. Only the slides change:
 * title, category, alternate titles and the rest stay. Without `chosen`,
 * a song changed here since (isUntouched) is left alone; a version the
 * user chose replaces even theirs, and the song follows the source again
 * (no longer marked as edited by hand). Each song updated is linked to the
 * source with its new lyrics as the source hash. Returns them.
 */
export function updateLibrarySongs(
  sourceId: string,
  changed: ChangedSong[],
  { chosen = false } = {},
): SongRef[] {
  fillContentHashes()
  const state = readSongSourceState(changed.map((c) => c.songId))
  const updated: SongRef[] = []
  const links: SourceLink[] = []
  for (const { songId, song } of changed) {
    const known = state.get(songId)
    if (!known || (!chosen && !isUntouched(known))) continue
    const saved = upsertSong({
      id: songId,
      title: song.parsed.title,
      slides: song.parsed.slides.map((slide, index) => ({
        content: slide.htmlContent,
        sortOrder: index,
        label: slide.label ?? null,
      })),
    })
    if (!saved) continue
    if (chosen) {
      getRawDatabase()
        .query('UPDATE songs SET last_manual_edit = NULL WHERE id = ?')
        .run(songId)
    }
    links.push({ songId, sourceSongId: song.id })
    updated.push({ id: songId, title: song.parsed.title })
  }
  linkSourceSongs(sourceId, links)
  batchUpdateSearchIndex(updated.map((song) => song.id as number))
  return updated
}
