import type { TermGroup, TermVariant } from './types'

/**
 * The FTS5 queries that find candidates, narrowest first:
 *
 * 1. the words as typed, as one phrase — a fragment copied from the text;
 * 2. every word, each in any of its variants (typos, other spellings);
 * 3. every word but one — the one typed too far off to recognise.
 *
 * Words the scoring alone looks at (see `TermGroup.required`) stay out.
 */
export function buildMatchTiers(groups: TermGroup[]): string[] {
  const required = groups.filter((group) => group.required)
  if (required.length === 0) return []

  const tiers: string[] = []
  if (groups.length > 1) tiers.push(phraseExpression(groups))
  tiers.push(allOf(required))
  if (required.length > 1) {
    tiers.push(
      required
        .map((_, skipped) =>
          allOf(required.filter((_, index) => index !== skipped)),
        )
        .join(' OR '),
    )
  }
  return tiers
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
