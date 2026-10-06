import { loadVocabulary } from './loadVocabulary'
import { lowerBound } from './lowerBound'
import type { Vocabulary } from './types'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'

const logger = createLogger('text-search:vocabulary')

/** The vocabulary of each FTS table, loaded on first use and kept in memory. */
const vocabularies = new Map<string, Vocabulary>()

export function getVocabulary(ftsTable: string): Vocabulary {
  let vocabulary = vocabularies.get(ftsTable)
  if (!vocabulary) {
    const start = performance.now()
    vocabulary = loadVocabulary(getRawDatabase(), ftsTable)
    vocabularies.set(ftsTable, vocabulary)
    logger.info(
      `${ftsTable}: ${vocabulary.terms.length} words loaded in ${(performance.now() - start).toFixed(0)}ms`,
    )
  }
  return vocabulary
}

/** Drops a table's vocabulary after a rebuild; the next search reloads it. */
export function resetVocabulary(ftsTable: string): void {
  vocabularies.delete(ftsTable)
}

/**
 * Adds the words of a newly indexed document, so a song saved a moment ago
 * is already found with a typo. Words that later leave the index stay: a
 * stale word only costs one lookup that matches nothing.
 */
export function addVocabularyWords(ftsTable: string, words: string[]): void {
  const vocabulary = vocabularies.get(ftsTable)
  if (!vocabulary) return
  for (const word of new Set(words)) {
    const at = lowerBound(vocabulary.terms, word)
    if (vocabulary.terms[at] === word) {
      vocabulary.docCounts[at]++
    } else {
      vocabulary.terms.splice(at, 0, word)
      vocabulary.docCounts.splice(at, 0, 1)
    }
  }
}
