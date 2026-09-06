import type { WorkspaceDropTarget, WorkspaceLayout } from '../types'

/** Mints a column id that no existing column uses. */
function nextColumnId(layout: WorkspaceLayout): string {
  const taken = new Set(layout.columns.map((column) => column.id))
  let index = layout.columns.length + 1
  while (taken.has(`col-${index}`)) index += 1
  return `col-${index}`
}

/**
 * Moves `panelId` next to the panel it was dropped on.
 *
 *  - `top` / `bottom` reorder it inside the target panel's column;
 *  - `left` / `right` split it out into a new column beside that one.
 *
 * Columns left empty by the move disappear, so the operator never ends up with
 * a dead gap they cannot fill. Returns the input untouched when the drop would
 * change nothing.
 */
export function moveWorkspacePanel(
  layout: WorkspaceLayout,
  panelId: string,
  target: WorkspaceDropTarget,
): WorkspaceLayout {
  if (panelId === target.panelId) return layout

  const newColumnId = nextColumnId(layout)
  const without = layout.columns.map((column) => ({
    id: column.id,
    panelIds: column.panelIds.filter((id) => id !== panelId),
  }))

  if (target.edge === 'left' || target.edge === 'right') {
    const columnIndex = without.findIndex(
      (column) => column.id === target.columnId,
    )
    if (columnIndex === -1) return layout
    const insertAt = target.edge === 'left' ? columnIndex : columnIndex + 1
    without.splice(insertAt, 0, { id: newColumnId, panelIds: [panelId] })
    return { columns: without.filter((column) => column.panelIds.length > 0) }
  }

  const column = without.find((item) => item.id === target.columnId)
  if (!column) return layout
  const anchor = column.panelIds.indexOf(target.panelId)
  if (anchor === -1) return layout
  column.panelIds.splice(
    target.edge === 'top' ? anchor : anchor + 1,
    0,
    panelId,
  )

  return { columns: without.filter((item) => item.panelIds.length > 0) }
}
