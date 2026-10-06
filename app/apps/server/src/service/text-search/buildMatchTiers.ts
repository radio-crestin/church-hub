import type { TermGroup, TermVariant } from './types'

/** The FTS5 queries that find a query's candidates. */
export interface MatchTiers {
  /**
   * Narrowest first: the words as typed, as one phrase (a fragment copied
   * from the text); then every word, each in any of its variants.
   */
  strict: string[]
  /** Every word but one: the one typed too far off to recognise. */
  loose: string | null
}

/**
 * The candidate queries of the term groups. Words the scoring alone looks
 * at (see `TermGroup.required`) stay out.
 */
export function buildMatchTiers(groups: TermGroup[]): MatchTiers {
  const required = groups.filter((group) => group.required)
  if (required.length === 0) return { strict: [], loose: null }

  // A last word too short to look up would make the phrase a prefix scan
  // over every word with that first letter; the phrase stops before it.
  const phraseGroups = groups.at(-1)?.required ? groups : groups.slice(0, -1)
  const strict: string[] = []
  if (phraseGroups.length > 1) strict.push(phraseExpression(phraseGroups))
  strict.push(allOf(required))
  const loose =
    required.length > 1
      ? required
          .map((_, skipped) =>
            allOf(required.filter((_, index) => index !== skipped)),
          )
          .join(' OR ')
      : null
  return { strict, loose }
}

function phraseExpression(groups: TermGroup[]): string {
  const typed = groups.map((group) => group.variants[0])
  const last = typed[typed.length - 1]
  return `"${typed.map((variant) => variant.text).join(' ')}"${last.prefix ? '*' : ''}`
}

function allOf(groups: TermGroup[]): string {
  return groups.map(anyVariant).join(' AND ')
}

function anyVariant(group: TermGroup): string {
  return `(${group.variants.map(variantExpression).join(' OR ')})`
}

function variantExpression(variant: TermVariant): string {
  return `"${variant.text}"${variant.prefix ? '*' : ''}`
}
