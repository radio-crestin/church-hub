import { getRawDatabase } from '../../../db'

/** Every song's slides, in order, joined into one text (as stored, HTML and all). */
export function loadSongLyrics(songIds: number[]): Map<number, string> {
  const lyrics = new Map<number, string>()
  if (songIds.length === 0) return lyrics
  const rows = getRawDatabase()
    .query(
      `SELECT song_id, content FROM song_slides
       WHERE song_id IN (${songIds.map(() => '?').join(',')})
       ORDER BY song_id, sort_order`,
    )
    .all(...songIds) as Array<{ song_id: number; content: string }>
  for (const row of rows) {
    const before = lyrics.get(row.song_id)
    lyrics.set(
      row.song_id,
      before === undefined ? row.content : `${before} ${row.content}`,
    )
  }
  return lyrics
}
