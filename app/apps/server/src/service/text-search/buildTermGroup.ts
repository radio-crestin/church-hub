import { documentFrequency } from './documentFrequency'
import { findSimilarTerms } from './findSimilarTerms'
import { elisionVariants } from './text/elisionVariants'
import { joinedWordVariants } from './text/joinedWordVariants'
import type { TermGroup, TermVariant, Vocabulary } from './types'
import { typoBudget } from './typoBudget'

const SIGNS_RE = /[^\p{L}\p{N}]+/u

/**
 * One typed word (folded, as `splitWordUnits` gives it) and every way it
 * may be written in a document: itself, its joined and elided spellings,
 * and the indexed words within its typo budget. `typing` marks the last
 * word while it is still being typed, matched as a beginning.
 */
export function buildTermGroup(
  unit: string,
  typing: boolean,
  vocabulary: Vocabulary,
): TermGroup {
  const pieces = unit.split(SIGNS_RE).filter((piece) => piece.length > 0)
  const compact = pieces.join('')
  const variants: TermVariant[] = [
    { text: pieces.join(' '), prefix: typing, edits: 0 },
  ]
  for (const spelling of [
    ...joinedWordVariants(unit),
    ...elisionVariants(compact),
  ]) {
    variants.push({ text: spelling, prefix: typing, edits: 0 })
  }
  if (pieces.length === 1) {
    variants.push(
      ...findSimilarTerms(vocabulary, compact, typoBudget(compact), typing),
    )
  }

  const required = compact.length >= (typing ? 3 : 2)
  return {
    typed: unit,
    variants: uniqueVariants(variants),
    pieces: pieces.length > 1 ? pieces : [],
    weight: termWeight(vocabulary, variants),
    required,
  }
}

/**
 * Inverse document frequency of the word as typed (or, when nothing holds
 * it, of its closest variant): a word in every verse says little, a rare
 * one pins the match down.
 */
function termWeight(vocabulary: Vocabulary, variants: TermVariant[]): number {
  const exact = variants.filter((variant) => variant.edits === 0)
  let frequency = Math.max(
    ...exact.map((variant) => documentFrequency(vocabulary, variant)),
  )
  if (frequency === 0) {
    const closest = variants.find((variant) => variant.edits > 0)
    frequency = closest ? documentFrequency(vocabulary, closest) : 0
  }
  return Math.log(1 + vocabulary.documentCount / (1 + frequency))
}

function uniqueVariants(variants: TermVariant[]): TermVariant[] {
  const seen = new Map<string, TermVariant>()
  for (const variant of variants) {
    const key = `${variant.text}${variant.prefix ? '*' : ''}`
    const kept = seen.get(key)
    if (!kept || variant.edits < kept.edits) seen.set(key, variant)
  }
  return Array.from(seen.values())
}
