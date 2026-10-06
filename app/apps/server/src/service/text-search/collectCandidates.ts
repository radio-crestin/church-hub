/**
 * Runs the match tiers narrowest first and keeps every new row, stopping as
 * soon as `wanted` rows are in hand: a later, looser tier can only add
 * weaker matches. `fetch` returns the rows of one FTS5 expression, best
 * BM25 first.
 */
export function collectCandidates<Row>(
  tiers: string[],
  wanted: number,
  fetch: (expression: string) => Row[],
  idOf: (row: Row) => number,
): Row[] {
  const candidates = new Map<number, Row>()
  for (const expression of tiers) {
    for (const row of fetch(expression)) {
      const id = idOf(row)
      if (!candidates.has(id)) candidates.set(id, row)
    }
    if (candidates.size >= wanted) break
  }
  return Array.from(candidates.values())
}
