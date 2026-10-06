import { getRawDatabase } from '../../../db'
import { createResultCache } from '../../text-search/createResultCache'
import { resetVocabulary } from '../../text-search/vocabularyStore'
import type { BibleSearchResult } from '../types'

export const VERSES_FTS_TABLE = 'bible_verses_fts'

/** Recent verse searches, by query, translation and limit. */
export const verseSearchCache = createResultCache<BibleSearchResult[]>(
  100,
  5 * 60 * 1000,
)

export interface RowidRange {
  from: number
  to: number
}

const translationRanges = new Map<number, RowidRange>()

/**
 * The verse ids a translation spans. An import writes a translation's
 * verses in one go, so they sit together and the index can be asked for
 * that stretch alone instead of every translation's matches.
 */
export function translationRowidRange(translationId: number): RowidRange {
  let range = translationRanges.get(translationId)
  if (!range) {
    const row = getRawDatabase()
      .query<{ from_id: number | null; to_id: number | null }, [number]>(
        'SELECT MIN(id) AS from_id, MAX(id) AS to_id FROM bible_verses WHERE translation_id = ?',
      )
      .get(translationId)
    range = { from: row?.from_id ?? 0, to: row?.to_id ?? -1 }
    translationRanges.set(translationId, range)
  }
  return range
}

/** Forgets everything derived from the verse index, after it changed. */
export function resetVerseSearchState(): void {
  verseSearchCache.clear()
  translationRanges.clear()
  resetVocabulary(VERSES_FTS_TABLE)
}
