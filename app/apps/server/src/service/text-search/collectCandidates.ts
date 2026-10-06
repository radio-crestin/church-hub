import type { MatchTiers } from './buildMatchTiers'

/**
 * Runs the strict tiers narrowest first and keeps every new row, stopping as
 * soon as `wanted` rows are in hand: a later tier only adds weaker matches.
 * The loose tier runs only when no document holds every word. `fetch`
 * returns the rows of one FTS5 expression, best first.
 */
export function collectCandidates<Row>(
  tiers: MatchTiers,
  wanted: number,
  fetch: (expression: string) => Row[],
  idOf: (row: Row) => number,
): Row[] {
  const candidates = new Map<number, Row>()
  const add = (expression: string) => {
    for (const row of fetch(expression)) {
      const id = idOf(row)
      if (!candidates.has(id)) candidates.set(id, row)
    }
  }
  for (const expression of tiers.strict) {
    add(expression)
    if (candidates.size >= wanted) break
  }
  if (candidates.size === 0 && tiers.loose) add(tiers.loose)
  return Array.from(candidates.values())
}
