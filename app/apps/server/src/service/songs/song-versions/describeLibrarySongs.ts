import { getRawDatabase } from '../../../db'

/** What a song list shows for each song found in the library. */
export interface LibrarySongSummary {
  title: string
  hymnNumber: string | null
  author: string | null
  categoryName: string | null
  keyLine: string | null
}

/** The songs found, in their order, with what a song list shows for each. */
export function describeLibrarySongs<T extends { songId: number }>(
  found: T[],
): Array<T & LibrarySongSummary> {
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
