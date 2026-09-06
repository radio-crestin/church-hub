import { useDraggable } from '@dnd-kit/core'
import { GripHorizontal } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { WorkspaceDropZones } from './WorkspaceDropZones'
import { WorkspacePanelGhost } from './WorkspacePanelGhost'
import type { WorkspacePanel } from '../types'

interface WorkspacePanelFrameProps {
  panel: WorkspacePanel
  columnId: string
  /** Id of the panel currently being dragged, if any. */
  draggingPanelId: string | null
  /** `true` while the page is in layout-editing mode. */
  editing: boolean
  /**
   * Reports the height the panel occupies while collapsed — its header alone.
   * The column pins the collapsed row to exactly that, so nothing is clipped.
   */
  onMeasureCollapsedHeight?: (height: number) => void
}

/**
 * Wraps one panel with everything that makes it movable: a grab handle (centred
 * just inside the panel's top edge, where no panel puts its own controls) and
 * the drop zones that appear on every *other* panel while a drag is running.
 *
 * The handle belongs to layout-editing mode and exists only there. Rearranging
 * is a deliberate trip through the page menu, not something a stray hover can
 * start, so outside that mode a panel offers no move affordance at all — the
 * grip is not merely faded out, it is not in the page.
 *
 * It sits *inside* the panel rather than straddling its top edge because that
 * edge already belongs to the row divider, which draws a grip of its own: a
 * handle hanging over it read as one control accidentally painted twice.
 */
export function WorkspacePanelFrame({
  panel,
  columnId,
  draggingPanelId,
  editing,
  onMeasureCollapsedHeight,
}: WorkspacePanelFrameProps) {
  const { t } = useTranslation('common')
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } =
    useDraggable({ id: panel.id })

  const isDragging = draggingPanelId === panel.id
  const isDragActive = draggingPanelId !== null
  const collapsed = panel.collapsed === true

  // While collapsed the content sizes to itself rather than filling the row, so
  // observing it yields the header's natural height — which is what the row
  // should shrink to.
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = contentRef.current
    if (!collapsed || !element || !onMeasureCollapsedHeight) return
    const report = () =>
      onMeasureCollapsedHeight(element.getBoundingClientRect().height)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [collapsed, onMeasureCollapsedHeight])

  return (
    <div
      ref={setNodeRef}
      data-testid={`workspace-panel-${panel.id}`}
      data-editing={editing ? 'true' : undefined}
      className={`relative h-full min-h-0 min-w-0 ${
        editing && !isDragging
          ? 'rounded-lg outline-2 outline-dashed outline-indigo-400/70 -outline-offset-2'
          : ''
      }`}
    >
      {/* A flex column, not a plain block: panels are written to fill their
          slot with `flex-1` as often as with `h-full`, and both only work if
          the wrapper is a flex container with a definite height. */}
      <div
        ref={contentRef}
        className={
          collapsed && !isDragging ? '' : 'flex h-full min-h-0 w-full flex-col'
        }
      >
        {isDragging ? (
          <WorkspacePanelGhost title={panel.title} />
        ) : (
          panel.render()
        )}
      </div>

      {editing ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          data-testid={`workspace-move-${panel.id}`}
          title={t('workspace.movePanel', { panel: panel.title })}
          aria-label={t('workspace.movePanel', { panel: panel.title })}
          className="absolute top-1.5 left-1/2 z-20 hidden h-4 w-10 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-indigo-400 bg-indigo-500 text-white transition-colors hover:bg-indigo-600 active:cursor-grabbing lg:flex dark:border-indigo-500"
        >
          <GripHorizontal size={12} />
        </button>
      ) : null}

      {isDragActive && !isDragging ? (
        <WorkspaceDropZones columnId={columnId} panelId={panel.id} />
      ) : null}
    </div>
  )
}
