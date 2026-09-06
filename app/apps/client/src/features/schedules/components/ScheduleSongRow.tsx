import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Pencil, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { ScheduleSungToggle } from './ScheduleSungToggle'
import type { ScheduleItem } from '../types'

interface ScheduleSongRowProps {
  item: ScheduleItem
  /** Highlights the song currently open on the song page. */
  isActive: boolean
  /** The program is showing a slide of this song right now. */
  isLive?: boolean
  /**
   * Drag-to-reorder is only meaningful on the unfiltered list, so the handle is
   * hidden while a search is narrowing the panel — same rule the Marcaje list
   * follows.
   */
  isSortable: boolean
  /** Scroll anchor, attached to the live row so the panel can follow along. */
  rowRef?: React.RefObject<HTMLDivElement | null>
  /** Projects this song from its first slide. */
  onPresent?: () => void
  onSelect: () => void
  /** Opens the program page's editor for this item. */
  onEdit?: () => void
  onRemove: () => void
  onToggleSung: () => void
}

/**
 * One song of a program: a compact row that projects the song when clicked.
 *
 * Deliberately title-only. Which verse goes up is chosen on the left of the
 * page — the slide rail — so this list stays a readable running order rather
 * than a second, competing verse picker.
 */
export function ScheduleSongRow({
  item,
  isActive,
  isLive = false,
  isSortable,
  rowRef,
  onPresent,
  onSelect,
  onEdit,
  onRemove,
  onToggleSung,
}: ScheduleSongRowProps) {
  const { t } = useTranslation('schedules')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isSortable })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleX: 1, scaleY: 1 } : null,
    ),
    transition: isDragging ? 'none' : (transition ?? undefined),
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  const getRowClass = () => {
    if (isDragging) {
      return 'opacity-80 shadow-lg border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/20'
    }
    if (isLive) {
      return 'border-orange-400 bg-orange-50 ring-2 ring-inset ring-orange-500 dark:border-orange-500 dark:bg-orange-900/30'
    }
    if (isActive) {
      return 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
    }
    if (item.isSung) {
      return 'border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10 hover:border-green-300 dark:hover:border-green-700'
    }
    return 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 bg-white dark:bg-gray-800 hover:bg-orange-50/50 dark:hover:bg-orange-900/10'
  }

  const song = item.song
  if (!song) return null

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        if (rowRef) rowRef.current = node
      }}
      style={style}
      data-testid="schedule-song-item"
      className={`flex items-center gap-1 rounded-lg border transition-colors ${getRowClass()}`}
    >
      {isSortable ? (
        <div
          {...attributes}
          {...listeners}
          data-testid="schedule-song-drag-handle"
          className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing rounded-l-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <GripVertical
            size={14}
            className="text-gray-400 dark:text-gray-500"
          />
        </div>
      ) : (
        <span className="w-1.5" />
      )}

      <ScheduleSungToggle
        isSung={item.isSung}
        onToggle={onToggleSung}
        testId="schedule-song-sung-toggle"
      />

      {/* The row body projects. Title only: category, key line and tags belong
          to the song, not to its place in the program. */}
      <button
        type="button"
        onClick={onPresent}
        title={t('panel.presentItem')}
        data-testid="schedule-song-present"
        className="flex-1 min-w-0 text-left py-1.5 pr-1 pl-1"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <ScheduleItemTypeIcon item={item} size="sm" />
          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {song.title}
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
        title={t('panel.openSong')}
        data-testid="schedule-song-open"
      >
        <ExternalLink size={14} />
      </button>

      {onEdit ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          title={t('contextMenu.edit')}
          data-testid="schedule-song-edit"
        >
          <Pencil size={14} />
        </button>
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-r-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title={t('panel.removeFromSchedule')}
        data-testid="schedule-song-remove"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}
