import { GripHorizontal, GripVertical } from 'lucide-react'
import { Separator } from 'react-resizable-panels'

interface WorkspaceSeparatorProps {
  /** Direction of the group the separator sits in. */
  orientation: 'horizontal' | 'vertical'
}

/**
 * The single divider look used everywhere in the app: a slim 8px gutter with a
 * grip that tints indigo on hover. Both orientations are exactly the same
 * thickness, so a column divider and a row divider read as the same control.
 */
export function WorkspaceSeparator({ orientation }: WorkspaceSeparatorProps) {
  const isColumnDivider = orientation === 'horizontal'

  return (
    <Separator
      className={`group hidden shrink-0 items-center justify-center rounded transition-colors hover:bg-indigo-100 lg:flex dark:hover:bg-indigo-900/30 ${
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
    </Separator>
  )
}
