import { createLyricsSnippet } from './createLyricsSnippet'
import { fetchSongCandidates, SONGS_FTS_TABLE } from './fetchSongCandidates'
import { loadSongLyrics } from './loadSongLyrics'
import { rankSongs } from './rankSongs'
import { searchByHymnNumber } from './searchByHymnNumber'
import { type SongSearchFilters, songFilterSql } from './songFilterSql'
import { songSearchCache, songSearchCacheKey } from './songSearchCache'
import { songSynonymsOf } from './songSynonymsOf'
import { createLogger } from '../../../utils/logger'
import { collectCandidates } from '../../text-search/collectCandidates'
import { highlightText } from '../../text-search/highlightText'
import { prepareTextQuery } from '../../text-search/prepareTextQuery'
import { decodeHtmlEntities } from '../../text-search/text/decodeHtmlEntities'
import type { SongSearchResult } from '../types'

const logger = createLogger('song-search')

/** "1. Când Isus…" and "265 - …": a hymn number typed before the title. */
const HYMN_NUMBER_PREFIX_RE = /^\s*\d+[.-]?\s+/

/**
 * Finds songs by title or by any part of their lyrics, typos and missing
 * diacritics included, on the shared text-search engine (see
 * `prepareTextQuery`). A query that is a hymn number finds that hymn.
 */
export function searchSongs(
  query: string,
  categoryIds?: number[],
  rawLimit = 50,
  filters?: SongSearchFilters,
): SongSearchResult[] {
  const startTime = performance.now()
  const limit = Math.min(Math.max(1, rawLimit), 200)
  if (!query.trim()) return []

  const cacheKey = songSearchCacheKey(query, categoryIds, filters)
  const cached = songSearchCache.get(cacheKey)
  if (cached) return cached.slice(0, limit)

  const filter = songFilterSql(categoryIds, filters)
  const results =
    searchByHymnNumber(query, filter, limit) ??
    searchByText(query.replace(HYMN_NUMBER_PREFIX_RE, ''), filter, limit)

  songSearchCache.set(cacheKey, results)
  logger.debug(
    `"${query}" → ${results.length} songs in ${(performance.now() - startTime).toFixed(1)}ms`,
  )
  return results
}

function searchByText(
  query: string,
  filter: ReturnType<typeof songFilterSql>,
  limit: number,
): SongSearchResult[] {
  const textQuery = prepareTextQuery(query, SONGS_FTS_TABLE, songSynonymsOf)
  const candidates = collectCandidates(
    textQuery.tiers,
    limit,
    (expression) => fetchSongCandidates(expression, filter),
    (song) => song.id,
  )
  const lyrics = loadSongLyrics(candidates.map((song) => song.id))
  const typedWords = textQuery.groups.flatMap((group) =>
    group.pieces.length > 0 ? group.pieces : [group.typed],
  )

  return rankSongs(candidates, lyrics, textQuery)
    .slice(0, limit)
    .map((ranked) => {
      const terms = [...typedWords, ...ranked.matchedForms]
      return {
        id: ranked.song.id,
        title: ranked.song.title,
        categoryId: ranked.song.category_id,
        categoryName: ranked.song.category_name,
        keyLine: ranked.song.key_line,
        highlightedTitle: highlightText(
          decodeHtmlEntities(ranked.song.title),
          terms,
          query,
        ),
        matchedContent: createLyricsSnippet(ranked.lyrics, terms, query),
        presentationCount: ranked.song.presentation_count,
        score: Math.min(100, Math.round(ranked.boostedScore)),
      }
    })
}
