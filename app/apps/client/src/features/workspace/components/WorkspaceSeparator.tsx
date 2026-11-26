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
 * grip that darkens on hover. Both orientations are exactly the same
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
      className={`group relative hidden shrink-0 items-center justify-center rounded transition-colors hover:bg-hover lg:flex ${
        isColumnDivider
          ? 'w-2 cursor-col-resize'
          : 'h-2 flex-col cursor-row-resize'
      }`}
    >
      {isColumnDivider ? (
        <GripVertical
          size={16}
          className="text-fg-hint transition-colors group-hover:text-fg"
        />
      ) : (
        <GripHorizontal
          size={16}
          className="text-fg-hint transition-colors group-hover:text-fg"
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
          className={`absolute top-3 z-20 flex h-6 w-5 cursor-pointer items-center justify-center rounded-md text-fg-hint transition-[opacity,color,background-color] duration-150 hover:bg-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            // At the top, level with the panels' headers, and quiet: no box,
            // shown when the divider is hovered — always while the column is
            // hidden, so the way back stays in sight. The grip in the middle
            // stays the divider's drag cue.
            columnToggle.collapsed
              ? 'right-0 opacity-100'
              : 'left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100'
          }`}
        >
          {columnToggle.collapsed ? (
            <ChevronLeft size={14} strokeWidth={1.75} />
          ) : (
            <ChevronRight size={14} strokeWidth={1.75} />
          )}
        </button>
      ) : null}
    </Separator>
  )
}
