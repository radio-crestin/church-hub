import type { SourceSong } from '@church-hub/song-formats'

import { readChangedSongs } from './changedSongsStore'
import { getRawDatabase } from '../../../db'
import { findSongSource } from '../listSongSources'

/** A library song the source changed, with both versions, for review. */
export interface ChangedSongReview {
  songId: number
  /** The library song's title and slides (HTML), as they are now. */
  library: { title: string; slides: string[] }
  /** The source's newer version. */
  song: SourceSong
}

/** The library song's title and slides, unless it was edited by hand. */
function readUntouched(songId: number): ChangedSongReview['library'] | null {
  const db = getRawDatabase()
  const row = db
    .query('SELECT title, last_manual_edit FROM songs WHERE id = ?')
    .get(songId) as { title: string; last_manual_edit: number | null } | null
  if (!row || row.last_manual_edit) return null
  const slides = db
    .query(
      'SELECT content FROM song_slides WHERE song_id = ? ORDER BY sort_order',
    )
    .all(songId) as { content: string }[]
  return { title: row.title, slides: slides.map((s) => s.content) }
}

/**
 * The library songs a source's last check found changed, each with its
 * library version beside the source's. A song edited by hand since the
 * check is left out: it is never replaced.
 */
export function readChangedForReview(sourceId: string): ChangedSongReview[] {
  findSongSource(sourceId)
  return readChangedSongs(sourceId).flatMap(({ songId, song }) => {
    const library = readUntouched(songId)
    return library ? [{ songId, library, song }] : []
  })
}
