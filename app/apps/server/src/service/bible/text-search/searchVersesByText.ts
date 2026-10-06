import {
  type RowidRange,
  translationRowidRange,
  VERSES_FTS_TABLE,
  verseSearchCache,
} from './verseSearchState'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'
import { collectCandidates } from '../../text-search/collectCandidates'
import { foldSearchText } from '../../text-search/foldSearchText'
import { highlightText } from '../../text-search/highlightText'
import { prepareTextQuery } from '../../text-search/prepareTextQuery'
import {
  CANDIDATES_PER_TIER,
  MAX_RANKED_MATCHES,
} from '../../text-search/rankingLimits'
import type { BibleSearchResult, SearchVersesInput } from '../types'
import { formatReference } from '../verses'

const logger = createLogger('bible:search')

const ALL_ROWIDS = { from: 0, to: Number.MAX_SAFE_INTEGER }

interface VerseRow {
  id: number
  translation_id: number
  book_id: number
  book_name: string
  book_code: string
  chapter: number
  verse: number
  text: string
  rank: number
}

/**
 * Finds verses by any part of their text, typos and missing diacritics
 * included, with the closest match first (see `prepareTextQuery`).
 */
export function searchVersesByText(
  input: SearchVersesInput,
): BibleSearchResult[] {
  const startTime = performance.now()
  const { query, translationId, limit: rawLimit = 30 } = input
  const limit = Math.min(Math.max(1, rawLimit), 100)
  if (!query || query.trim().length < 2) return []

  const cacheKey = `${foldSearchText(query.trimStart())}|${translationId ?? 'all'}|${limit}`
  const cached = verseSearchCache.get(cacheKey)
  if (cached) return cached

  const textQuery = prepareTextQuery(query, VERSES_FTS_TABLE)
  const range = translationId
    ? translationRowidRange(translationId)
    : ALL_ROWIDS
  const candidates = collectCandidates(
    textQuery.tiers,
    limit,
    (expression) => fetchVerses(expression, range, translationId),
    (row) => row.id,
  )

  const results = candidates
    .map((row) => ({ row, match: textQuery.score(row.text) }))
    .sort(
      (a, b) =>
        a.match.matchClass - b.match.matchClass ||
        b.match.score - a.match.score ||
        a.row.rank - b.row.rank,
    )
    .slice(0, limit)
    .map(({ row, match }) => ({
      id: row.id,
      translationId: row.translation_id,
      bookId: row.book_id,
      bookName: row.book_name,
      bookCode: row.book_code,
      chapter: row.chapter,
      verse: row.verse,
      text: row.text,
      reference: formatReference(row.book_name, row.chapter, row.verse),
      highlightedText: highlightText(row.text, match.matchedForms, query),
    }))

  verseSearchCache.set(cacheKey, results)
  logger.debug(
    `"${query}" → ${results.length} verses from ${candidates.length} candidates in ${(performance.now() - startTime).toFixed(1)}ms`,
  )
  return results
}

/**
 * The verses one FTS5 expression matches within a translation's rowid
 * stretch, best BM25 first unless the match is too broad to rank cheaply
 * (see `MAX_RANKED_MATCHES`), then in Bible order.
 */
function fetchVerses(
  expression: string,
  range: RowidRange,
  translationId: number | undefined,
): VerseRow[] {
  const db = getRawDatabase()
  const matches =
    db
      .query<{ n: number }, [string, number, number]>(
        `SELECT COUNT(*) AS n FROM ${VERSES_FTS_TABLE}
         WHERE ${VERSES_FTS_TABLE} MATCH ?1 AND rowid BETWEEN ?2 AND ?3`,
      )
      .get(expression, range.from, range.to)?.n ?? 0
  if (matches === 0) return []
  const order = matches <= MAX_RANKED_MATCHES ? 'ORDER BY rank' : ''
  return db
    .query<VerseRow, [string, number, number]>(
      `SELECT v.id, v.translation_id, v.book_id, b.book_name, b.book_code,
              v.chapter, v.verse, v.text, fts.rank
       FROM (
         SELECT rowid AS rid, rank FROM ${VERSES_FTS_TABLE}
         WHERE ${VERSES_FTS_TABLE} MATCH ?1 AND rowid BETWEEN ?2 AND ?3
         ${order} LIMIT ${CANDIDATES_PER_TIER}
       ) fts
       JOIN bible_verses v ON v.id = fts.rid
       JOIN bible_books b ON b.id = v.book_id
       ${translationId ? `WHERE v.translation_id = ${Number(translationId)}` : ''}`,
    )
    .all(expression, range.from, range.to)
}
