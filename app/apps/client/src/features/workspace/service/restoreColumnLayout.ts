/**
 * Percentages a column's rows should take when one of them is expanded back to
 * a remembered height.
 *
 * Asking the panel group to resize a single row is not enough: it takes the
 * space it needs from the row next to it, so a row remembered at 95% pushes its
 * immediate neighbour straight through its minimum and the group answers that
 * by collapsing it to nothing — header included. The whole column has to be
 * laid out at once instead, with every open row guaranteed a floor.
 */
export function restoreColumnLayout({
  current,
  panelId,
  remembered,
  collapsedPanelIds,
  minOpenShare,
}: {
  /** The group's layout right now, as panel id → percentage. */
  current: Record<string, number>
  /** The row being expanded. */
  panelId: string
  /** Percentage it would like back. */
  remembered: number
  /** Rows pinned to their header — their share is not up for grabs. */
  collapsedPanelIds: ReadonlySet<string>
  /** Smallest share an open row may be pushed to, as a percentage. */
  minOpenShare: number
}): Record<string, number> {
  const others = Object.keys(current).filter((id) => id !== panelId)
  const pinned = others.filter((id) => collapsedPanelIds.has(id))
  const flexible = others.filter((id) => !collapsedPanelIds.has(id))

  const pinnedTotal = pinned.reduce((sum, id) => sum + (current[id] ?? 0), 0)
  const budget = Math.max(0, 100 - pinnedTotal)
  // What is left after every other open row has been given its floor.
  const ceiling = budget - flexible.length * minOpenShare
  const restored = Math.max(minOpenShare, Math.min(remembered, ceiling))
  const room = Math.max(0, budget - restored)

  const flexibleTotal = flexible.reduce(
    (sum, id) => sum + (current[id] ?? 0),
    0,
  )
  const next: Record<string, number> = { ...current }
  next[panelId] = restored
  for (const id of flexible) {
    // Rows keep their relative proportions; an all-zero column (every row
    // dragged shut) shares the room evenly instead of dividing by zero.
    const share =
      flexibleTotal > 0
        ? (current[id] ?? 0) / flexibleTotal
        : 1 / flexible.length
    next[id] = Math.max(minOpenShare, room * share)
  }
  return next
}
