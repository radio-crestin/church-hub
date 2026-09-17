/**
 * How far past its header a row may reach and still count as showing nothing
 * else, as a percentage of the column. Covers the rounding between a header's
 * measured height and the share the group pinned the row to.
 */
const HEADER_TOLERANCE = 0.5

/**
 * Percentages a column's rows should take whenever the set of shut rows
 * changes, and once when the column first appears.
 *
 * A shut row gets exactly its header, and the open rows share everything else:
 *
 *   - when a row is being opened, every open row gets an equal part, so opening
 *     one section beside shut ones fills the column and opening a second one
 *     splits it in half;
 *   - otherwise the open rows keep their proportions, so closing a section
 *     hands its room to every section still open, each sized the way the
 *     operator left it.
 *
 * The whole column is laid out at once because a row cannot do this on its
 * own: collapsing or expanding one panel resizes it against the single row next
 * to it. A closing row's room then goes to that neighbour even when it is shut
 * too, leaving a header over an empty band while the open rows further away
 * never grow.
 */
export function layoutColumnRows({
  current,
  headerShares,
  shutPanelIds,
  previouslyShut,
  minOpenShare,
}: {
  /** The group's layout right now, as panel id → percentage. */
  current: Record<string, number>
  /** Each row that has a header to shrink to → that header, as a percentage. */
  headerShares: Record<string, number>
  /** Rows whose panel is shut. */
  shutPanelIds: ReadonlySet<string>
  /**
   * Whether each row was shut when the column was last laid out. A row missing
   * here — on the column's first pass, or one that has just joined it — counts
   * as being opened when it is open but no taller than its header: it was shut
   * when these sizes were saved and has been opened since, e.g. in the other
   * editing layout, which shares the song page's open/shut preferences.
   */
  previouslyShut: ReadonlyMap<string, boolean>
  /** Smallest share a row may be given when a row is opened, as a percentage. */
  minOpenShare: number
}): Record<string, number> {
  const ids = Object.keys(current)
  const atHeader = (id: string) =>
    headerShares[id] !== undefined &&
    current[id] <= headerShares[id] + HEADER_TOLERANCE
  const opening = ids.some(
    (id) => !shutPanelIds.has(id) && (previouslyShut.get(id) ?? atHeader(id)),
  )

  // An open row the operator dragged down to its header stays there while
  // other rows open and close around it — unless a row is being opened, which
  // shares the column between every open row.
  const pinned = ids.filter(
    (id) => shutPanelIds.has(id) || (!opening && atHeader(id)),
  )
  // With nothing open, something still has to reach the bottom of the column:
  // the last row does, so the spare room sits below every header rather than
  // between two of them.
  const growing = ids.filter((id) => !pinned.includes(id))
  const fillers = growing.length > 0 ? growing : ids.slice(-1)

  const next: Record<string, number> = { ...current }
  let budget = 100
  for (const id of pinned) {
    if (fillers.includes(id)) continue
    next[id] = headerShares[id] ?? current[id]
    budget -= next[id]
  }
  budget = Math.max(0, budget)

  const total = fillers.reduce((sum, id) => sum + current[id], 0)
  for (const id of fillers) {
    if (opening) next[id] = Math.max(minOpenShare, budget / fillers.length)
    else if (total > 0) next[id] = (budget * current[id]) / total
    else next[id] = budget / fillers.length
  }
  return next
}
