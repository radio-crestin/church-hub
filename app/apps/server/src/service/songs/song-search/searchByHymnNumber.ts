import type { SongFilterSql } from './songFilterSql'
import { getRawDatabase } from '../../../db'
import { decodeHtmlEntities } from '../../text-search/text/decodeHtmlEntities'
import { escapeHtml } from '../../text-search/text/escapeHtml'
import type { SongSearchResult } from '../types'

const HYMN_NUMBER_RE = /^#?(\d+)$/

interface HymnRow {
  id: number
  title: string
  category_id: number | null
  category_name: string | null
  key_line: string | null
  hymn_number: string | null
  presentation_count: number
}

/**
 * A query that is only a hymn number ("#034", "34") finds the songs with
 * that number, or whose title starts with it, before any text search.
 * Returns null when the query is not a number or nothing carries it.
 */
export function searchByHymnNumber(
  query: string,
  filter: SongFilterSql,
  limit: number,
): SongSearchResult[] | null {
  const match = query.trim().match(HYMN_NUMBER_RE)
  if (!match) return null
  const typed = match[1]
  const value = Number.parseInt(typed, 10).toString()

  const rows = getRawDatabase()
    .query(
      `SELECT s.id, s.title, s.category_id, sc.name AS category_name,
              s.presentation_count, s.key_line, s.hymn_number
       FROM songs s
       LEFT JOIN song_categories sc ON s.category_id = sc.id
       WHERE (
         s.hymn_number = ?
         OR s.hymn_number = ?
         OR CAST(CAST(s.hymn_number AS INTEGER) AS TEXT) = ?
         OR (
           s.title GLOB '[0-9]*'
           AND CAST(SUBSTR(s.title, 1,
             CASE WHEN INSTR(s.title, ' ') > 0
               THEN INSTR(s.title, ' ') - 1
               ELSE LENGTH(s.title)
             END
           ) AS INTEGER) = CAST(? AS INTEGER)
         )
       )
       ${filter.sql}
       LIMIT 20`,
    )
    .all(typed, `#${typed}`, value, value, ...filter.params) as HymnRow[]
  if (rows.length === 0) return null

  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    categoryName: row.category_name,
    keyLine: row.key_line,
    highlightedTitle: escapeHtml(decodeHtmlEntities(row.title)),
    matchedContent: row.hymn_number ? `Hymn #${row.hymn_number}` : '',
    presentationCount: row.presentation_count,
    score: 100,
  }))
}
