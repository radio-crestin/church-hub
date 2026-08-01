import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem } from '../types'

interface ScheduleSongRowProps {
  item: ScheduleItem
  /** Highlights the song currently open on the song page. */
  isActive: boolean
  /**
   * Drag-to-reorder is only meaningful on the unfiltered list, so the handle is
   * hidden while a search or a sung filter is narrowing the panel — same rule
   * the Marcaje list follows.
   */
  isSortable: boolean
  onSelect: () => void
  onRemove: () => void
  onToggleSung: () => void
}

/**
 * One song of a schedule, rendered with the same affordances as a Marcaje row:
 * a drag handle, a sung checkmark, the title with its category / key line /
 * tags, and an X to drop it from the program. Kept visually identical to
 * `SortableBookmarkItem` on purpose — the operator reads both lists the same
 * way.
 */
export function ScheduleSongRow({
  item,
  isActive,
  isSortable,
  onSelect,
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

  const song = item.song
  if (!song) return null

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="schedule-song-item"
      className={`flex items-center gap-1 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-80 shadow-lg border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/20'
          : isActive
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
            : item.isSung
              ? 'border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10 hover:border-green-300 dark:hover:border-green-700'
              : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 bg-white dark:bg-gray-800 hover:bg-orange-50/50 dark:hover:bg-orange-900/10'
      }`}
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

      <button
        type="button"
        onClick={onToggleSung}
        aria-pressed={item.isSung}
        title={item.isSung ? t('panel.markNotSung') : t('panel.markSung')}
        data-testid="schedule-song-sung-toggle"
        className={`flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
          item.isSung
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 dark:border-gray-600 text-transparent hover:border-green-400 hover:text-green-400'
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left py-1.5 pr-1 pl-1"
      >
        <div className="text-sm font-medium truncate text-gray-900 dark:text-white">
          {song.title}
        </div>
        {(song.categoryName || item.keyLine) && (
          <div className="flex items-center gap-2 mt-0.5">
            {song.categoryName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {song.categoryName}
              </span>
            )}
            {item.keyLine && (
              <span
                className="text-xs text-amber-600 dark:text-amber-400 shrink-0"
                data-testid="schedule-song-key-line"
              >
                {item.keyLine}
              </span>
            )}
          </div>
        )}
        {song.tagNames?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {song.tagNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium leading-none bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </button>

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
