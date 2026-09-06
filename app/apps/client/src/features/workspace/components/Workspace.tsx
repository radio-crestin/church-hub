import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { GripHorizontal } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'

import { WorkspaceColumnView } from './WorkspaceColumnView'
import { WorkspaceEditToolbar } from './WorkspaceEditToolbar'
import { WorkspaceSeparator } from './WorkspaceSeparator'
import { useWorkspaceEditing } from '../hooks/useWorkspaceEditing'
import { useWorkspaceLayout } from '../hooks/useWorkspaceLayout'
import { moveWorkspacePanel } from '../service/moveWorkspacePanel'
import { parseDropZoneId } from '../service/workspaceDropZoneId'
import { sizesStorageKey } from '../service/workspaceStorage'
import type {
  WorkspaceDropTarget,
  WorkspaceLayout,
  WorkspacePanel,
} from '../types'

interface WorkspaceProps {
  /** Namespaces this workspace's persisted arrangement and sizes. */
  id: string
  panels: WorkspacePanel[]
  /** Where panels sit until the operator moves them. */
  defaultLayout: WorkspaceLayout
  /** Width each default column opens at, e.g. `['30%', '40%', '30%']`. */
  defaultColumnSizes?: string[]
  /**
   * `true` on small screens: panels stack in their default order, with no
   * resizing and no dragging. The stored desktop arrangement is left untouched.
   */
  stacked: boolean
  className?: string
}

/**
 * A page's resizable, rearrangeable panel area.
 *
 * Panels can be dragged by the handle on their top edge and dropped above or
 * below any other panel to reorder, or onto a panel's left/right edge to split
 * off a new column — so the same set of views can be laid out as three columns,
 * as a column with something stacked under the preview, or any mix of the two.
 * Both the arrangement and every panel size are persisted per device.
 *
 * While a drag is running the page shows the arrangement it *would* have: the
 * other panels flow into their new places straight away and the dragged panel's
 * slot is drawn as an outline, so dropping holds no surprises. The "Edit
 * layout" action in the page's menu turns every handle on at once for operators
 * who would never find them by hovering.
 */
export function Workspace({
  id,
  panels,
  defaultLayout,
  defaultColumnSizes,
  stacked,
  className = '',
}: WorkspaceProps) {
  const available = panels.filter((panel) => panel.available !== false)
  const availableIds = available.map((panel) => panel.id)
  const panelsById = new Map(available.map((panel) => [panel.id, panel]))

  const { layout, movePanel, resetLayout, isCustomised } = useWorkspaceLayout(
    id,
    defaultLayout,
    availableIds,
  )
  const { editing, setEditing } = useWorkspaceEditing(id)
  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<WorkspaceDropTarget | null>(null)

  // Editing is a mode you are in for a moment: leaving the page ends it, so
  // coming back never lands in a mode the operator has forgotten about.
  useEffect(() => () => setEditing(false), [setEditing])

  // What the arrangement would be if the drag ended here. Rendering this rather
  // than the committed layout is what makes the panels flow in real time.
  const previewLayout =
    draggingPanelId && dropTarget
      ? moveWorkspacePanel(layout, draggingPanelId, dropTarget)
      : layout

  // Panels the page cannot offer right now (a missing permission, a
  // desktop-only panel on a narrow window) keep their stored slot but are not
  // rendered — and a column left with nothing to show takes up no space.
  const columns = previewLayout.columns
    .map((column) => ({
      id: column.id,
      panelIds: column.panelIds.filter((panelId) => panelsById.has(panelId)),
    }))
    .filter((column) => column.panelIds.length > 0)

  const columnKey = columns.map((column) => column.id).join('|')
  const columnIds = useMemo(
    () => (columnKey === '' ? [] : columnKey.split('|')),
    [columnKey],
  )
  const { defaultLayout: columnSizes, onLayoutChanged } = useDefaultLayout({
    id: sizesStorageKey(id, 'columns'),
    panelIds: columnIds,
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  if (stacked) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {available.map((panel) => (
          <Fragment key={panel.id}>{panel.render()}</Fragment>
        ))}
      </div>
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingPanelId(String(event.active.id))
    setDropTarget(null)
  }

  /**
   * Reflowing the page moves the drop zones out from under the pointer — most
   * of all the one just used, which the dragged panel's outline now covers. So
   * a pointer over nothing keeps the last real target instead of snapping the
   * preview back, which would flicker between two arrangements forever.
   */
  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id
    if (overId === undefined) return
    const target = parseDropZoneId(String(overId))
    if (target && target.panelId !== String(event.active.id)) {
      setDropTarget(target)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id
    const target =
      (overId === undefined ? null : parseDropZoneId(String(overId))) ??
      dropTarget
    // The preview already showed this move; committing it is what makes it
    // survive the drop and the next reload.
    if (target) movePanel(String(event.active.id), target)
    setDraggingPanelId(null)
    setDropTarget(null)
  }

  const handleDragCancel = () => {
    setDraggingPanelId(null)
    setDropTarget(null)
  }

  const group = (
    <Group
      id={`${id}-columns`}
      orientation="horizontal"
      className={
        editing ? 'min-h-0 min-w-0 flex-1' : `min-h-0 min-w-0 ${className}`
      }
      defaultLayout={columnSizes}
      onLayoutChanged={onLayoutChanged}
    >
      {columns.map((column, index) => (
        <Fragment key={column.id}>
          {index > 0 ? <WorkspaceSeparator orientation="horizontal" /> : null}
          <Panel
            id={column.id}
            className="min-h-0 min-w-0"
            collapsible
            collapsedSize="0%"
            minSize="10%"
            defaultSize={defaultColumnSizes?.[index]}
          >
            <WorkspaceColumnView
              workspaceId={id}
              column={column}
              panelsById={panelsById}
              draggingPanelId={draggingPanelId}
              editing={editing}
            />
          </Panel>
        </Fragment>
      ))}
    </Group>
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      // The preview moves the panels as the pointer travels, so the drop zones
      // have to be re-measured while dragging or they would answer for where
      // the panels used to be.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {editing ? (
        <div className={`flex min-h-0 min-w-0 flex-col gap-2 ${className}`}>
          <WorkspaceEditToolbar
            isCustomised={isCustomised}
            onReset={resetLayout}
            onDone={() => setEditing(false)}
          />
          {group}
        </div>
      ) : (
        group
      )}

      {/* The panel being carried is a small label under the pointer — the slot
          it would land in is already drawn in place, so this only has to say
          *what* is being moved. */}
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {draggingPanelId ? (
          <div className="pointer-events-none inline-flex items-center gap-2 rounded-lg border border-indigo-400 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-lg dark:bg-gray-800 dark:text-gray-200">
            <GripHorizontal size={14} className="text-indigo-500" />
            {panelsById.get(draggingPanelId)?.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
