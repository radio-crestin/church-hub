import type { SongFilterSql } from './songFilterSql'
import { getRawDatabase } from '../../../db'
import {
  CANDIDATES_PER_TIER,
  MAX_RANKED_MATCHES,
} from '../../text-search/rankingLimits'

export const SONGS_FTS_TABLE = 'songs_fts'

export interface SongCandidate {
  id: number
  title: string
  alternate_titles: string | null
  category_id: number | null
  category_name: string | null
  category_priority: number
  presentation_count: number
  key_line: string | null
  rank: number
}

/**
 * The songs one FTS5 expression matches within the filters, best BM25
 * first unless the match is too broad to rank cheaply (see
 * `MAX_RANKED_MATCHES`).
 */
export function fetchSongCandidates(
  expression: string,
  filter: SongFilterSql,
): SongCandidate[] {
  const db = getRawDatabase()
  const matches =
    db
      .query<{ n: number }, [string]>(
        `SELECT COUNT(*) AS n FROM ${SONGS_FTS_TABLE} WHERE ${SONGS_FTS_TABLE} MATCH ?`,
      )
      .get(expression)?.n ?? 0
  if (matches === 0) return []
  const order = matches <= MAX_RANKED_MATCHES ? 'ORDER BY rank' : ''
  return db
    .query(
      `SELECT s.id, s.title, s.alternate_titles, s.category_id,
              sc.name AS category_name,
              COALESCE(sc.priority, 1) AS category_priority,
              s.presentation_count, s.key_line, ${SONGS_FTS_TABLE}.rank AS rank
       FROM ${SONGS_FTS_TABLE}
       JOIN songs s ON s.id = ${SONGS_FTS_TABLE}.song_id
       LEFT JOIN song_categories sc ON s.category_id = sc.id
       WHERE ${SONGS_FTS_TABLE} MATCH ? ${filter.sql}
       ${order} LIMIT ${CANDIDATES_PER_TIER}`,
    )
    .all(expression, ...filter.params) as SongCandidate[]
}
