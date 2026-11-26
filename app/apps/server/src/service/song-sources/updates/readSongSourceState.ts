import { getRawDatabase } from '../../../db'

const CHUNK = 500

/** What decides whether a library song may follow its source. */
export interface SongSourceState {
  id: number
  title: string
  last_manual_edit: number | null
  source_id: string | null
  source_hash: string | null
  content_hash: string | null
}

/** The library songs' source state, by id (content hashes filled first by the match). */
export function readSongSourceState(
  ids: number[],
): Map<number, SongSourceState> {
  const db = getRawDatabase()
  const songs = new Map<number, SongSourceState>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const marks = chunk.map(() => '?').join(',')
    const rows = db
      .query(
        `SELECT id, title, last_manual_edit, source_id, source_hash, content_hash
         FROM songs WHERE id IN (${marks})`,
      )
      .all(...chunk) as SongSourceState[]
    for (const row of rows) songs.set(row.id, row)
  }
  return songs
}

/**
 * Whether nobody changed the song here since its source last gave it its
 * lyrics: never edited by hand, and its lyrics still the source's (a song
 * from before source hashes has only the first check).
 */
export function isUntouched(song: SongSourceState): boolean {
  if (song.last_manual_edit) return false
  return song.source_hash === null || song.source_hash === song.content_hash
}
