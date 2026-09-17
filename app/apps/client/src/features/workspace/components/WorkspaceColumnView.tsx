import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'
import { Group, useDefaultLayout, useGroupRef } from 'react-resizable-panels'

import { WorkspaceColumnPanel } from './WorkspaceColumnPanel'
import { WorkspaceSeparator } from './WorkspaceSeparator'
import { layoutColumnRows } from '../service/layoutColumnRows'
import { sizesStorageKey } from '../service/workspaceStorage'
import type { WorkspaceColumn, WorkspacePanel } from '../types'

/**
 * Room an open row needs before the column would rather scroll than squeeze it.
 * Enough for a header plus a couple of list rows, so a panel that is nominally
 * open never shrinks to something an operator cannot read.
 */
const OPEN_ROW_MIN_PX = 140
/**
 * A collapsed row is its header, and the header alone is what it needs. Also
 * what a header is taken to measure until its row has reported it.
 */
const COLLAPSED_ROW_MIN_PX = 48
/** Height of the `WorkspaceSeparator` gutter drawn between two rows. */
const SEPARATOR_PX = 8
/** Cap on the floor an open row is given, for very tall columns. */
const MAX_OPEN_SHARE_PERCENT = 30

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
 *
 * Two things keep every panel reachable, and both are the column's business
 * rather than any single row's:
 *
 *   - the rows share the column as percentages, so on a short window three open
 *     panels would be squeezed until none of them showed anything. The group is
 *     given a floor — the height its rows actually need — and the column
 *     scrolls past it instead of compressing them;
 *   - opening or shutting a row lays out the *whole* column at once: the shut
 *     rows keep exactly their header and the open rows share everything else
 *     (see `layoutColumnRows`). Resizing just the one row would trade space
 *     with whichever row happens to sit next to it — pushing that one off the
 *     screen, or pouring a shut row's room under a neighbour that is shut too.
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

  const groupRef = useGroupRef()
  const groupElementRef = useRef<HTMLDivElement>(null)

  // A collapsed row only ever needs its header, so a column of collapsed
  // panels keeps the same floor it always had and never scrolls.
  const minGroupHeight = panels.reduce(
    (total, panel, index) =>
      total +
      (panel.collapsed === true ? COLLAPSED_ROW_MIN_PX : OPEN_ROW_MIN_PX) +
      (index > 0 ? SEPARATOR_PX : 0),
    0,
  )

  // What each row's header measures, as the rows report it: a shut row is
  // pinned to exactly that. A ref, since only laying the column out reads it.
  const headerHeights = useRef<Record<string, number>>({})
  const measureHeader = useCallback((panelId: string, height: number) => {
    headerHeights.current[panelId] = height
  }, [])

  // Which rows are shut (`1`), open (`0`) or have no header to shut to (`-`),
  // as a string so the effect below fires on a real change rather than on
  // every render.
  const collapsedSignature = panels
    .map(
      (panel) =>
        `${panel.id}:${panel.collapsed === undefined ? '-' : panel.collapsed ? '1' : '0'}`,
    )
    .join('|')
  const previouslyShut = useRef<ReadonlyMap<string, boolean>>(new Map())

  useEffect(() => {
    // Rows with a header to shut to → whether they are shut right now.
    const shutByRow = new Map<string, boolean>()
    for (const entry of collapsedSignature.split('|')) {
      const [panelId, state] = entry.split(':')
      if (panelId && state !== '-') shutByRow.set(panelId, state === '1')
    }
    const shutPanelIds = new Set(
      [...shutByRow].filter(([, shut]) => shut).map(([panelId]) => panelId),
    )

    // A frame later, so a row that has just mounted — a panel dropped into
    // this column — is registered with the group before it is laid out.
    const frame = requestAnimationFrame(() => {
      const group = groupRef.current
      const element = groupElementRef.current
      if (!group || !element) return
      const current = group.getLayout()
      const rowCount = Object.keys(current).length
      // What the group's percentages are of: the rows, without the dividers.
      const rowsHeight = element.clientHeight - SEPARATOR_PX * (rowCount - 1)
      // A group not measured yet has no layout to work from.
      if (rowCount === 0 || rowsHeight <= 0) return

      const toShare = (px: number) => (px / rowsHeight) * 100
      group.setLayout(
        layoutColumnRows({
          current,
          headerShares: Object.fromEntries(
            [...shutByRow.keys()].map((panelId) => [
              panelId,
              toShare(headerHeights.current[panelId] ?? COLLAPSED_ROW_MIN_PX),
            ]),
          ),
          shutPanelIds,
          previouslyShut: previouslyShut.current,
          minOpenShare: Math.min(
            MAX_OPEN_SHARE_PERCENT,
            toShare(OPEN_ROW_MIN_PX),
          ),
        }),
      )
      // Only once the column has actually been laid out: a pass cancelled
      // by a quicker change must not lose the rows it was opening.
      previouslyShut.current = shutByRow
    })
    return () => cancelAnimationFrame(frame)
  }, [collapsedSignature, groupRef])

  return (
    <div
      data-testid={`workspace-column-${column.id}`}
      className="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-thin"
    >
      <Group
        id={`${workspaceId}-${column.id}`}
        orientation="vertical"
        className="h-full min-w-0"
        style={{ minHeight: minGroupHeight }}
        groupRef={groupRef}
        elementRef={groupElementRef}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        {panels.map((panel, index) => (
          <Fragment key={panel.id}>
            {index > 0 ? <WorkspaceSeparator orientation="vertical" /> : null}
            <WorkspaceColumnPanel
              panel={panel}
              columnId={column.id}
              draggingPanelId={draggingPanelId}
              editing={editing}
              onMeasureHeader={measureHeader}
            />
          </Fragment>
        ))}
      </Group>
    </div>
  )
}
