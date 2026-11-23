import type { WorkspaceLayout } from '../types'

/**
 * Brings a stored arrangement in line with the panels a page can offer.
 *
 * Only *additions* are reconciled: a panel the stored layout has never seen
 * joins the column that already holds its default neighbours, so a newly-added
 * panel lands next to the ones it belongs with instead of at the far edge.
 *
 * Panels that are merely unavailable right now — a permission not granted, a
 * panel that only exists on desktop — are deliberately left in place. They are
 * skipped at render time, and keeping their slot means an operator who resizes
 * the window or regains a permission gets their own arrangement back rather
 * than the default.
 */
export function reconcileWorkspaceLayout(
  stored: WorkspaceLayout | null,
  fallback: WorkspaceLayout,
  availableIds: readonly string[],
): WorkspaceLayout {
  const base = stored ?? fallback
  const columns = base.columns.map((column) => ({
    id: column.id,
    panelIds: [...column.panelIds],
  }))

  const placed = new Set(columns.flatMap((column) => column.panelIds))

  for (const panelId of availableIds) {
    if (placed.has(panelId)) continue

    const fallbackIndex = fallback.columns.findIndex((column) =>
      column.panelIds.includes(panelId),
    )
    const fallbackColumn = fallback.columns[fallbackIndex]
    const neighbours =
      fallbackColumn?.panelIds.filter((id) => id !== panelId) ?? []

    // A panel the page gives a column of its own (automation beside the
    // preview) gets that column back, in its default place.
    if (
      fallbackColumn &&
      neighbours.length === 0 &&
      !columns.some((column) => column.id === fallbackColumn.id)
    ) {
      columns.splice(Math.min(fallbackIndex, columns.length), 0, {
        id: fallbackColumn.id,
        panelIds: [panelId],
      })
      placed.add(panelId)
      continue
    }

    const target =
      columns.find((column) =>
        column.panelIds.some((id) => neighbours.includes(id)),
      ) ?? columns[columns.length - 1]

    if (target) {
      target.panelIds.push(panelId)
    } else {
      columns.push({ id: `col-${columns.length + 1}`, panelIds: [panelId] })
    }
    placed.add(panelId)
  }

  return { columns }
}
