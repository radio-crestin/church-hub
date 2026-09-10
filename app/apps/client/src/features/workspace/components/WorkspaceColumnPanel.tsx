import { useEffect, useRef, useState } from 'react'
import { Panel, usePanelRef } from 'react-resizable-panels'

import { WorkspacePanelFrame } from './WorkspacePanelFrame'
import type { WorkspacePanel } from '../types'

/** Height a collapsed row falls back to until its header has been measured. */
const ASSUMED_HEADER_PX = 48

interface WorkspaceColumnPanelProps {
  panel: WorkspacePanel
  columnId: string
  draggingPanelId: string | null
  /** `true` while the page is in layout-editing mode. */
  editing: boolean
}

/**
 * One resizable row of a column.
 *
 * A row can shrink to nothing in two ways, and both are honoured here: dragging
 * the divider past the row's minimum collapses it (that is how a panel is
 * hidden now that there is no separate hide button), and clicking the panel's
 * own collapse chevron pins the row to exactly its header height so the
 * remaining panels take the freed space instead of leaving a gap.
 *
 * Sizing the column when a row opens is the column's job, not this row's: a
 * row can only resize itself, and doing that takes the space from whichever
 * neighbour happens to sit next to it.
 */
export function WorkspaceColumnPanel({
  panel,
  columnId,
  draggingPanelId,
  editing,
}: WorkspaceColumnPanelProps) {
  const panelRef = usePanelRef()
  const collapsed = panel.collapsed === true
  // A panel that declares a collapsed state has a chevron and a header to fall
  // back to, so dragging its divider all the way stops at that header rather
  // than taking the panel off the screen. Panels that declare none — the
  // verses, the control panel, the stage — keep the drag as their way of being
  // hidden outright, since they have no header left behind to bring them back.
  const stopsAtHeader = panel.collapsed !== undefined
  // Measured from the panel's own header, so a taller header is never clipped.
  const [headerHeight, setHeaderHeight] = useState<number>()
  const previousCollapsed = useRef<boolean | undefined>(undefined)

  useEffect(() => {
    const previous = previousCollapsed.current
    if (previous === collapsed) return
    previousCollapsed.current = collapsed

    if (collapsed) {
      // A row that has just been dropped (or previewed) into another column
      // mounts fresh, and its new group has not registered it yet — collapsing
      // it in this pass would throw. One frame later the group knows about it.
      const frame = requestAnimationFrame(() => panelRef.current?.collapse())
      return () => cancelAnimationFrame(frame)
    }

    // On mount an open row is already sized by the group's stored layout; only
    // a real expand has to be let out of its collapsed size.
    if (previous === undefined) return
    panelRef.current?.expand()
  }, [collapsed, panel.id, panelRef])

  return (
    <Panel
      id={panel.id}
      panelRef={panelRef}
      className="min-h-0 min-w-0"
      collapsible
      collapsedSize={
        collapsed || stopsAtHeader ? (headerHeight ?? ASSUMED_HEADER_PX) : '0%'
      }
      minSize={panel.minSize ?? '10%'}
      defaultSize={panel.defaultSize}
    >
      <WorkspacePanelFrame
        panel={panel}
        columnId={columnId}
        draggingPanelId={draggingPanelId}
        editing={editing}
        onMeasureCollapsedHeight={setHeaderHeight}
      />
    </Panel>
  )
}
