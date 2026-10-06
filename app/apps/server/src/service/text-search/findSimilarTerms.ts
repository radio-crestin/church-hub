import { lowerBound } from './lowerBound'
import type { TermVariant, Vocabulary } from './types'

const MAX_SIMILAR_TERMS = 24
const PAST_EVERY_CHAR = '￿'

interface Found extends TermVariant {
  docCount: number
}

/**
 * The words of the vocabulary within `maxEdits` typos of `word` (a letter
 * added, dropped, changed, or two neighbours swapped). With `asPrefix` the
 * word is still being typed, so a vocabulary word also counts when its
 * beginning (as long as what was typed, or longer) is within reach; that
 * beginning comes back as a prefix variant standing for every word under it.
 *
 * The sorted vocabulary is walked as a trie: words sharing a beginning share
 * those rows of the edit-distance table, and a beginning already out of
 * reach skips every word that starts with it. The closest and most common
 * words come first.
 */
export function findSimilarTerms(
  vocabulary: Vocabulary,
  word: string,
  maxEdits: number,
  asPrefix: boolean,
): TermVariant[] {
  if (maxEdits === 0 || word.length === 0) return []
  const { terms, docCounts } = vocabulary
  const width = word.length + 1
  const rows: Int32Array[] = [Int32Array.from({ length: width }, (_, j) => j)]
  const found: Found[] = []
  let previous = ''
  let index = 0

  const skipBeginning = (term: string, depth: number) => {
    index = lowerBound(terms, term.slice(0, depth) + PAST_EVERY_CHAR)
    previous = term.slice(0, depth)
  }

  outer: while (index < terms.length) {
    const term = terms[index]
    const shared = commonPrefixLength(previous, term)
    for (let depth = shared + 1; depth <= term.length; depth++) {
      const row = nextRow(rows, depth, term, word)
      const distance = row[word.length]
      if (
        asPrefix &&
        depth >= word.length &&
        distance <= maxEdits &&
        depth < term.length
      ) {
        found.push({
          text: term.slice(0, depth),
          prefix: true,
          edits: distance,
          docCount: docCounts[index],
        })
        skipBeginning(term, depth)
        continue outer
      }
      if (minOf(row) > maxEdits) {
        skipBeginning(term, depth)
        continue outer
      }
    }
    const distance = rows[term.length][word.length]
    if (distance <= maxEdits) {
      found.push({
        text: term,
        prefix: false,
        edits: distance,
        docCount: docCounts[index],
      })
    }
    previous = term
    index++
  }

  found.sort((a, b) => a.edits - b.edits || b.docCount - a.docCount)
  return found
    .slice(0, MAX_SIMILAR_TERMS)
    .map(({ text, prefix, edits }) => ({ text, prefix, edits }))
}

/** Row `depth` of the edit-distance table (restricted Damerau–Levenshtein). */
function nextRow(
  rows: Int32Array[],
  depth: number,
  term: string,
  word: string,
): Int32Array {
  const above = rows[depth - 1]
  const twoAbove = depth >= 2 ? rows[depth - 2] : null
  const row = rows[depth] ?? new Int32Array(word.length + 1)
  rows[depth] = row
  const char = term.charCodeAt(depth - 1)
  row[0] = depth
  for (let j = 1; j <= word.length; j++) {
    const cost = word.charCodeAt(j - 1) === char ? 0 : 1
    let best = Math.min(above[j] + 1, row[j - 1] + 1, above[j - 1] + cost)
    if (
      twoAbove &&
      j >= 2 &&
      char === word.charCodeAt(j - 2) &&
      term.charCodeAt(depth - 2) === word.charCodeAt(j - 1)
    ) {
      best = Math.min(best, twoAbove[j - 2] + 1)
    }
    row[j] = best
  }
  return row
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let length = 0
  while (length < max && a.charCodeAt(length) === b.charCodeAt(length)) length++
  return length
}

function minOf(row: Int32Array): number {
  let min = row[0]
  for (let j = 1; j < row.length; j++) if (row[j] < min) min = row[j]
  return min
}
