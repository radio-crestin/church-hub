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
  /** Changed here since the source gave it: a new version, never applied on its own. */
  edited: boolean
}

/** The library song's title and slides, as they are now. */
function readLibrarySong(songId: number): ChangedSongReview['library'] | null {
  const db = getRawDatabase()
  const row = db.query('SELECT title FROM songs WHERE id = ?').get(songId) as {
    title: string
  } | null
  if (!row) return null
  const slides = db
    .query(
      'SELECT content FROM song_slides WHERE song_id = ? ORDER BY sort_order',
    )
    .all(songId) as { content: string }[]
  return { title: row.title, slides: slides.map((s) => s.content) }
}

/**
 * The library songs a source's last check found changed, each with its
 * library version beside the source's, and whether it was changed here
 * (then it is a new version available, never applied on its own).
 */
export function readChangedForReview(sourceId: string): ChangedSongReview[] {
  findSongSource(sourceId)
  return readChangedSongs(sourceId).flatMap(({ songId, song, edited }) => {
    const library = readLibrarySong(songId)
    return library ? [{ songId, library, song, edited: edited === true }] : []
  })
}
