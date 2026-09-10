import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Group, useDefaultLayout, useGroupRef } from 'react-resizable-panels'

import { WorkspaceColumnPanel } from './WorkspaceColumnPanel'
import { WorkspaceSeparator } from './WorkspaceSeparator'
import { restoreColumnLayout } from '../service/restoreColumnLayout'
import { sizesStorageKey } from '../service/workspaceStorage'
import type { WorkspaceColumn, WorkspacePanel } from '../types'

/**
 * Room an open row needs before the column would rather scroll than squeeze it.
 * Enough for a header plus a couple of list rows, so a panel that is nominally
 * open never shrinks to something an operator cannot read.
 */
const OPEN_ROW_MIN_PX = 140
/** A collapsed row is its header, and the header alone is what it needs. */
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
 *   - opening a row lays out the *whole* column at once: the shut rows keep
 *     their header and every open row shares what is left equally. Resizing
 *     just the one row would take the space from whichever row happens to sit
 *     next to it, and could still push that one off the screen.
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

  // Which rows are shut, as a string so the effect below fires on a real
  // change rather than on every render.
  const collapsedSignature = panels
    .map((panel) => `${panel.id}:${panel.collapsed === true ? '1' : '0'}`)
    .join('|')
  const previousCollapsed = useRef<Record<string, boolean> | undefined>(
    undefined,
  )

  useEffect(() => {
    const collapsedById: Record<string, boolean> = {}
    for (const entry of collapsedSignature.split('|')) {
      if (!entry) continue
      const [panelId, flag] = entry.split(':')
      collapsedById[panelId] = flag === '1'
    }
    const previous = previousCollapsed.current
    previousCollapsed.current = collapsedById
    // Nothing to restore on the first pass: the group's stored layout already
    // describes where the rows sit.
    if (!previous) return

    const opened = Object.keys(collapsedById).find(
      (panelId) =>
        previous[panelId] === true && collapsedById[panelId] === false,
    )
    if (!opened) return

    // The row expands itself first (it owns its own `Panel` handle); laying the
    // column out has to wait for that to land.
    const frame = requestAnimationFrame(() => {
      const group = groupRef.current
      if (!group) return
      const height = groupElementRef.current?.clientHeight ?? 0
      const minOpenShare =
        height > 0
          ? Math.min(MAX_OPEN_SHARE_PERCENT, (OPEN_ROW_MIN_PX / height) * 100)
          : MAX_OPEN_SHARE_PERCENT
      const collapsedShare =
        height > 0 ? (COLLAPSED_ROW_MIN_PX / height) * 100 : minOpenShare
      group.setLayout(
        restoreColumnLayout({
          current: group.getLayout(),
          panelId: opened,
          collapsedShare,
          collapsedPanelIds: new Set(
            Object.keys(collapsedById).filter((id) => collapsedById[id]),
          ),
          minOpenShare,
        }),
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [collapsedSignature, groupRef, workspaceId])

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
            />
          </Fragment>
        ))}
      </Group>
    </div>
  )
}
