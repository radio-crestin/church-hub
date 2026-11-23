import type { SuggestedSong } from './types'
import { getRawDatabase } from '../../db'

type Found = Pick<SuggestedSong, 'songId' | 'score'>

/**
 * The scored songs, in the same order, with what a suggestion list shows for
 * each (title, hymn number, author, category, key); deleted ones dropped.
 */
export function describeSuggestedSongs<T extends Found>(
  found: T[],
): Array<T & SuggestedSong> {
  if (found.length === 0) return []
  const rows = getRawDatabase()
    .query(
      `SELECT s.id, s.title, s.hymn_number, s.author, s.key_line,
              sc.name AS category_name
       FROM songs s LEFT JOIN song_categories sc ON sc.id = s.category_id
       WHERE s.id IN (${found.map(() => '?').join(',')})`,
    )
    .all(...found.map((song) => song.songId)) as Array<{
    id: number
    title: string
    hymn_number: string | null
    author: string | null
    key_line: string | null
    category_name: string | null
  }>
  const byId = new Map(rows.map((row) => [row.id, row]))
  return found.flatMap((song) => {
    const row = byId.get(song.songId)
    if (!row) return []
    return [
      {
        ...song,
        title: row.title,
        hymnNumber: row.hymn_number,
        author: row.author,
        categoryName: row.category_name,
        keyLine: row.key_line,
      },
    ]
  })
}
