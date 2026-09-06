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
 * on the panel's top edge, where no panel puts its own controls) and the drop
 * zones that appear on every *other* panel while a drag is running.
 *
 * The handle only fades in on hover normally, so it stays out of the way; in
 * layout-editing mode every panel shows its handle at once and is outlined, so
 * the operator can see at a glance what can be moved.
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
      className={`group/wsp relative h-full min-h-0 min-w-0 ${
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

      <button
        type="button"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        data-testid={`workspace-move-${panel.id}`}
        title={t('workspace.movePanel', { panel: panel.title })}
        aria-label={t('workspace.movePanel', { panel: panel.title })}
        className={`absolute -top-1 left-1/2 z-20 hidden h-4 w-10 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border transition-opacity focus-visible:opacity-100 active:cursor-grabbing lg:flex ${
          editing
            ? 'border-indigo-400 bg-indigo-500 text-white opacity-100 hover:bg-indigo-600 dark:border-indigo-500'
            : 'border-gray-200 bg-white text-gray-400 opacity-0 group-hover/wsp:opacity-100 hover:text-indigo-500 dark:border-gray-600 dark:bg-gray-800'
        }`}
      >
        <GripHorizontal size={12} />
      </button>

      {isDragActive && !isDragging ? (
        <WorkspaceDropZones columnId={columnId} panelId={panel.id} />
      ) : null}
    </div>
  )
}
