import { getRawDatabase } from '../../db'

export interface SongIndexRow {
  id: number
  title: string
  alternate_titles: string | null
  category_name: string
  /** The song's slides in their order, joined by spaces. */
  content: string
}

/**
 * What the FTS index holds for each song: all songs, or only `songIds`.
 * Slides are read per song through `idx_song_slides_song_id_sort_order`, so a
 * batch reads only its own slides, in order (a join on an ordered subquery
 * sorted the whole table per batch and lost the order in GROUP BY).
 */
export function fetchSongIndexRows(songIds?: number[]): SongIndexRow[] {
  const where = songIds
    ? `WHERE s.id IN (${songIds.map(() => '?').join(',')})`
    : ''
  return getRawDatabase()
    .query(
      `SELECT
         s.id,
         s.title,
         s.alternate_titles,
         COALESCE(sc.name, '') AS category_name,
         COALESCE((
           SELECT GROUP_CONCAT(content, ' ') FROM (
             SELECT content FROM song_slides
             WHERE song_id = s.id ORDER BY sort_order
           )
         ), '') AS content
       FROM songs s
       LEFT JOIN song_categories sc ON s.category_id = sc.id
       ${where}`,
    )
    .all(...(songIds ?? [])) as SongIndexRow[]
}
