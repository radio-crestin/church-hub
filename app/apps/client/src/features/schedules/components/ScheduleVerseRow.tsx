import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BookOpen, Check, GripVertical, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem } from '../types'

interface ScheduleVerseRowProps {
  item: ScheduleItem
  /** Highlights the passage currently open on the Bible page. */
  isActive: boolean
  isSortable: boolean
  onSelect: () => void
  onRemove: () => void
  onToggleSung: () => void
}

/**
 * One bible passage of a schedule. The verse counterpart of `ScheduleSongRow`,
 * kept structurally identical — done-marker, title line, metadata, X — so the
 * Programe panel reads the same whether it is listing songs or verses.
 */
export function ScheduleVerseRow({
  item,
  isActive,
  isSortable,
  onSelect,
  onRemove,
  onToggleSung,
}: ScheduleVerseRowProps) {
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

  // The stored reference already carries the translation suffix
  // ("Ioan 3:16 - VDCC"); strip it so the badge can show it separately.
  const reference =
    item.biblePassageReference?.split(' - ')[0] ??
    item.biblePassageVerses[0]?.reference ??
    ''
  const preview = item.biblePassageVerses[0]?.text ?? ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="schedule-verse-item"
      className={`flex items-center gap-1 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-80 shadow-lg border-teal-400 dark:border-teal-500 bg-teal-50 dark:bg-teal-900/20'
          : isActive
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
            : item.isSung
              ? 'border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10 hover:border-green-300 dark:hover:border-green-700'
              : 'border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/10'
      }`}
    >
      {isSortable ? (
        <div
          {...attributes}
          {...listeners}
          data-testid="schedule-verse-drag-handle"
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
        title={item.isSung ? t('panel.markNotRead') : t('panel.markRead')}
        data-testid="schedule-verse-read-toggle"
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
        <div className="flex items-center gap-1.5 min-w-0">
          <BookOpen
            size={12}
            className="shrink-0 text-teal-600 dark:text-teal-400"
          />
          <span className="text-sm font-medium truncate text-gray-900 dark:text-white">
            {reference}
          </span>
          {item.biblePassageTranslation && (
            <span className="shrink-0 text-[10px] font-medium text-teal-600 dark:text-teal-400">
              {item.biblePassageTranslation}
            </span>
          )}
        </div>
        {preview && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
            {preview}
          </div>
        )}
        {item.biblePassageVerses.length > 1 && (
          <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
            {t('panel.verseCount', { count: item.biblePassageVerses.length })}
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
        data-testid="schedule-verse-remove"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}
