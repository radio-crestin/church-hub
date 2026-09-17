import {
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  GripVertical,
} from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Separator } from 'react-resizable-panels'

interface WorkspaceSeparatorProps {
  /** Direction of the group the separator sits in. */
  orientation: 'horizontal' | 'vertical'
  /**
   * Puts a hide/show button on a column divider for the column to its right,
   * so the operator can give the rest of the page its width in one click.
   */
  columnToggle?: {
    collapsed: boolean
    onToggle: () => void
  }
}

/**
 * The single divider look used everywhere in the app: a slim 8px gutter with a
 * grip that tints indigo on hover. Both orientations are exactly the same
 * thickness, so a column divider and a row divider read as the same control.
 */
export function WorkspaceSeparator({
  orientation,
  columnToggle,
}: WorkspaceSeparatorProps) {
  const { t } = useTranslation('common')
  const isColumnDivider = orientation === 'horizontal'
  // The button sits on the divider, so pressing it also starts a resize: a
  // press that dragged the divider somewhere must not also hide the column.
  const pressX = useRef<number | null>(null)
  const toggleLabel = columnToggle?.collapsed
    ? t('workspace.showColumn')
    : t('workspace.hideColumn')

  return (
    <Separator
      className={`group relative hidden shrink-0 items-center justify-center rounded transition-colors hover:bg-indigo-100 lg:flex dark:hover:bg-indigo-900/30 ${
        isColumnDivider
          ? 'w-2 cursor-col-resize'
          : 'h-2 flex-col cursor-row-resize'
      }`}
    >
      {isColumnDivider ? (
        <GripVertical
          size={16}
          className="text-gray-400 transition-colors group-hover:text-indigo-500"
        />
      ) : (
        <GripHorizontal
          size={16}
          className="text-gray-400 transition-colors group-hover:text-indigo-500"
        />
      )}
      {columnToggle ? (
        // A collapsed column leaves its divider on the page's right edge, where
        // the group clips anything past it — so the button then hangs left.
        <button
          type="button"
          onPointerDown={(event) => {
            pressX.current = event.clientX
          }}
          onClick={(event) => {
            const dragged =
              pressX.current !== null &&
              Math.abs(event.clientX - pressX.current) > 4
            pressX.current = null
            if (!dragged) columnToggle.onToggle()
          }}
          aria-label={toggleLabel}
          aria-expanded={!columnToggle.collapsed}
          title={toggleLabel}
          data-testid="workspace-last-column-toggle"
          className={`absolute top-1/2 z-20 flex h-8 w-4 cursor-pointer items-center justify-center rounded border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400 ${
            // Just above the grip, which stays the divider's drag cue.
            columnToggle.collapsed
              ? 'right-0 -translate-y-[calc(100%+12px)]'
              : 'left-1/2 -translate-x-1/2 -translate-y-[calc(100%+12px)]'
          }`}
        >
          {columnToggle.collapsed ? (
            <ChevronLeft size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
      ) : null}
    </Separator>
  )
}
