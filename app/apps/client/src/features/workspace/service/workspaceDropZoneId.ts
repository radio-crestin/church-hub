import type { WorkspaceDropEdge, WorkspaceDropTarget } from '../types'

const SEPARATOR = '::'
const EDGES: readonly WorkspaceDropEdge[] = ['top', 'bottom', 'left', 'right']

/** Encodes a drop target as the dnd-kit droppable id it is registered under. */
export function toDropZoneId(target: WorkspaceDropTarget): string {
  return [target.columnId, target.panelId, target.edge].join(SEPARATOR)
}

/** Decodes a droppable id back into a drop target, or `null` if it is not one. */
export function parseDropZoneId(id: string): WorkspaceDropTarget | null {
  const [columnId, panelId, edge] = id.split(SEPARATOR)
  if (!columnId || !panelId) return null
  if (!EDGES.includes(edge as WorkspaceDropEdge)) return null
  return { columnId, panelId, edge: edge as WorkspaceDropEdge }
}
