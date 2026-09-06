import { Fragment, useMemo } from 'react'
import { Group, useDefaultLayout } from 'react-resizable-panels'

import { WorkspaceColumnPanel } from './WorkspaceColumnPanel'
import { WorkspaceSeparator } from './WorkspaceSeparator'
import { sizesStorageKey } from '../service/workspaceStorage'
import type { WorkspaceColumn, WorkspacePanel } from '../types'

interface WorkspaceColumnViewProps {
  workspaceId: string
  column: WorkspaceColumn
  panelsById: Map<string, WorkspacePanel>
  draggingPanelId: string | null
  /** `true` while the page is in layout-editing mode. */
  editing: boolean
}

/**
 * One column of the workspace: its panels stacked top to bottom, each row
 * resizable against its neighbour. A row dragged all the way onto its
 * neighbour collapses to nothing, which is how an operator hides a panel now
 * that there is no separate hide button — dragging the divider back brings it
 * straight out again. Row heights persist per column arrangement.
 */
export function WorkspaceColumnView({
  workspaceId,
  column,
  panelsById,
  draggingPanelId,
  editing,
}: WorkspaceColumnViewProps) {
  const panels = column.panelIds
    .map((panelId) => panelsById.get(panelId))
    .filter((panel): panel is WorkspacePanel => panel !== undefined)

  const panelIds = useMemo(
    () => panels.map((panel) => panel.id),
    [column.panelIds.join('|')],
  )

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: sizesStorageKey(workspaceId, column.id),
    panelIds,
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
  })

  return (
    <Group
      id={`${workspaceId}-${column.id}`}
      orientation="vertical"
      className="h-full min-h-0 min-w-0"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      {panels.map((panel, index) => (
        <Fragment key={panel.id}>
          {index > 0 ? <WorkspaceSeparator orientation="vertical" /> : null}
          <WorkspaceColumnPanel
            workspaceId={workspaceId}
            panel={panel}
            columnId={column.id}
            draggingPanelId={draggingPanelId}
            editing={editing}
          />
        </Fragment>
      ))}
    </Group>
  )
}
