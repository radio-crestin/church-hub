/**
 * Percentages a column's rows should take when one of them is opened.
 *
 * One rule, so a column behaves the same however its panels got where they
 * are: the rows that are shut keep their header, and every row that is open
 * shares what is left equally. Opening a panel while its neighbours are shut
 * therefore fills the column, and opening a second one splits it in half —
 * which is what an operator expects from a stack of sections, rather than the
 * panel coming back at whatever height it happened to have once.
 *
 * Laying the whole column out at once is also the only way to get this right:
 * resizing a single row takes the space from whichever row happens to sit next
 * to it, so a row could still push its immediate neighbour off the screen.
 */
export function restoreColumnLayout({
  current,
  panelId,
  collapsedPanelIds,
  collapsedShare,
  minOpenShare,
}: {
  /** The group's layout right now, as panel id → percentage. */
  current: Record<string, number>
  /** The row being opened. */
  panelId: string
  /** Rows that are shut — they get their header and nothing more. */
  collapsedPanelIds: ReadonlySet<string>
  /** What a shut row's header is worth, as a percentage of the column. */
  collapsedShare: number
  /** Smallest share an open row may be given, as a percentage. */
  minOpenShare: number
}): Record<string, number> {
  const ids = Object.keys(current)
  const pinned = ids.filter((id) => id !== panelId && collapsedPanelIds.has(id))
  const open = ids.filter((id) => id === panelId || !collapsedPanelIds.has(id))
  if (open.length === 0) return { ...current }

  // A shut row is worth its header, not whatever it happens to occupy right
  // now. The group will not shrink its last row to nothing, so a column whose
  // rows are all shut still has one of them filling it — reading that as the
  // space it needs would leave the row being opened with almost none.
  const pinnedTotal = pinned.length * collapsedShare
  const budget = Math.max(0, 100 - pinnedTotal)
  const share = Math.max(minOpenShare, budget / open.length)

  const next: Record<string, number> = { ...current }
  for (const id of pinned) next[id] = collapsedShare
  for (const id of open) next[id] = share
  return next
}
