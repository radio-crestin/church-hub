import { useEffect, useRef, useState } from 'react'
import { Panel, type PanelSize, usePanelRef } from 'react-resizable-panels'

import { WorkspacePanelFrame } from './WorkspacePanelFrame'
import { readPanelHeights, writePanelHeight } from '../service/workspaceStorage'
import type { WorkspacePanel } from '../types'

/** Height a collapsed row falls back to until its header has been measured. */
const ASSUMED_HEADER_PX = 48

interface WorkspaceColumnPanelProps {
  workspaceId: string
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
 * Collapsing throws the row's height away — the neighbours take the space — so
 * the height it had while open is remembered here and handed straight back when
 * the operator expands it again, on this visit or on the next one.
 */
export function WorkspaceColumnPanel({
  workspaceId,
  panel,
  columnId,
  draggingPanelId,
  editing,
}: WorkspaceColumnPanelProps) {
  const panelRef = usePanelRef()
  const collapsed = panel.collapsed === true
  // Measured from the panel's own header, so a taller header is never clipped.
  const [headerHeight, setHeaderHeight] = useState<number>()
  const previousCollapsed = useRef<boolean | undefined>(undefined)
  // Percentage of the column this row goes back to when it is expanded, kept
  // current while the panel is open and seeded from the previous visit.
  const openHeight = useRef<number | undefined>(
    readPanelHeights(workspaceId)[panel.id],
  )

  // `Panel` keeps a stable handle on this callback, so reading `collapsed`
  // straight from the render scope is safe.
  const handleResize = (size: PanelSize) => {
    // Sizes taken while collapsed are not heights worth returning to: the row
    // is pinned to its header, or dragged away to nothing.
    if (collapsed || panelRef.current?.isCollapsed()) return
    openHeight.current = size.asPercentage
  }

  useEffect(() => {
    const previous = previousCollapsed.current
    if (previous === collapsed) return
    previousCollapsed.current = collapsed

    if (collapsed) {
      // Written now rather than on every drag frame: this is the one moment the
      // height is about to be lost.
      if (openHeight.current !== undefined) {
        writePanelHeight(workspaceId, panel.id, openHeight.current)
      }
      // A row that has just been dropped (or previewed) into another column
      // mounts fresh, and its new group has not registered it yet — collapsing
      // it in this pass would throw. One frame later the group knows about it.
      const frame = requestAnimationFrame(() => panelRef.current?.collapse())
      return () => cancelAnimationFrame(frame)
    }

    // On mount an open row is already sized by the group's stored layout; only
    // a real expand has a height to put back.
    if (previous === undefined) return
    panelRef.current?.expand()
    // A bare number would be read as pixels — the remembered height is a
    // percentage of the column, so it has to say so.
    if (openHeight.current !== undefined) {
      panelRef.current?.resize(`${openHeight.current}%`)
    }
  }, [collapsed, panel.id, panelRef, workspaceId])

  return (
    <Panel
      id={panel.id}
      panelRef={panelRef}
      className="min-h-0 min-w-0"
      collapsible
      collapsedSize={collapsed ? (headerHeight ?? ASSUMED_HEADER_PX) : '0%'}
      minSize={panel.minSize ?? '10%'}
      defaultSize={panel.defaultSize}
      onResize={handleResize}
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
