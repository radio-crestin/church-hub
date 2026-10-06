import { lowerBound } from './lowerBound'
import type { TermVariant, Vocabulary } from './types'

const PAST_EVERY_CHAR = '￿'

/**
 * How many documents hold a variant, from the vocabulary: its word's count,
 * the sum over every word it begins (a prefix, capped at the documents
 * there are), or its rarest piece (a phrase like "s a").
 */
export function documentFrequency(
  vocabulary: Vocabulary,
  variant: TermVariant,
): number {
  const pieces = variant.text.split(' ')
  if (pieces.length > 1) {
    return Math.min(
      ...pieces.map((piece, index) =>
        documentFrequency(vocabulary, {
          ...variant,
          text: piece,
          prefix: variant.prefix && index === pieces.length - 1,
        }),
      ),
    )
  }
  const { terms, docCounts, documentCount } = vocabulary
  const start = lowerBound(terms, variant.text)
  if (!variant.prefix) {
    return terms[start] === variant.text ? docCounts[start] : 0
  }
  const end = lowerBound(terms, variant.text + PAST_EVERY_CHAR)
  let sum = 0
  for (let index = start; index < end && sum < documentCount; index++) {
    sum += docCounts[index]
  }
  return Math.min(sum, documentCount)
}
