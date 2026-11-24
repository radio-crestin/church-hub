import { normalizeForSearch } from '~/utils/normalizeForSearch'
import type { BibleTopic } from '../types'

/**
 * The topics whose English or Romanian title holds the query, diacritics
 * folded ("iertare" finds "Iertarea"), sorted by the title the user reads.
 */
export function filterBibleTopics(
  topics: BibleTopic[],
  query: string,
  titleOf: (topic: BibleTopic) => string,
): BibleTopic[] {
  const q = normalizeForSearch(query.trim())
  const matches = q
    ? topics.filter(
        (topic) =>
          normalizeForSearch(topic.titleRo).includes(q) ||
          normalizeForSearch(topic.titleEn).includes(q),
      )
    : topics
  return [...matches].sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
}
