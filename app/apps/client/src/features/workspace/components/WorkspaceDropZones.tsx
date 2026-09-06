import { useDroppable } from '@dnd-kit/core'

import { toDropZoneId } from '../service/workspaceDropZoneId'
import type { WorkspaceDropEdge } from '../types'

/**
 * The four landing areas overlaid on a panel while a drag is in progress. They
 * tile the panel without overlapping, so exactly one is ever under the pointer
 * and the highlight can never flicker between two of them.
 */
const ZONES: ReadonlyArray<{ edge: WorkspaceDropEdge; className: string }> = [
  { edge: 'left', className: 'inset-y-0 left-0 w-1/5' },
  { edge: 'right', className: 'inset-y-0 right-0 w-1/5' },
  { edge: 'top', className: 'top-0 left-1/5 right-1/5 h-1/2' },
  { edge: 'bottom', className: 'bottom-0 left-1/5 right-1/5 h-1/2' },
]

interface WorkspaceDropZoneProps {
  columnId: string
  panelId: string
  edge: WorkspaceDropEdge
  className: string
}

function WorkspaceDropZone({
  columnId,
  panelId,
  edge,
  className,
}: WorkspaceDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: toDropZoneId({ columnId, panelId, edge }),
  })

  return (
    <div
      ref={setNodeRef}
      data-testid={`workspace-drop-${panelId}-${edge}`}
      className={`absolute z-30 rounded transition-colors ${className} ${
        isOver ? 'bg-indigo-500/30 ring-2 ring-indigo-500 ring-inset' : ''
      }`}
    />
  )
}

interface WorkspaceDropZonesProps {
  columnId: string
  panelId: string
}

/**
 * Shows where a dragged panel would land: dropping on the top or bottom half
 * reorders it inside this column, dropping on a side edge splits it out into a
 * new column of its own.
 */
export function WorkspaceDropZones({
  columnId,
  panelId,
}: WorkspaceDropZonesProps) {
  return (
    <>
      {ZONES.map((zone) => (
        <WorkspaceDropZone
          key={zone.edge}
          columnId={columnId}
          panelId={panelId}
          edge={zone.edge}
          className={zone.className}
        />
      ))}
    </>
  )
}
