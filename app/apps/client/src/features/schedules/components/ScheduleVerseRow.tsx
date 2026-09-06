import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Pencil, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { ScheduleSungToggle } from './ScheduleSungToggle'
import type { ScheduleItem } from '../types'

interface ScheduleVerseRowProps {
  item: ScheduleItem
  /** Highlights the passage currently open on the Bible page. */
  isActive: boolean
  /** The program is showing a verse of this passage right now. */
  isLive?: boolean
  isSortable: boolean
  /** Scroll anchor, attached to the live row so the panel can follow along. */
  rowRef?: React.RefObject<HTMLDivElement | null>
  /** Projects this passage from its first verse. */
  onPresent?: () => void
  onSelect: () => void
  /** Opens the program page's editor for this item. */
  onEdit?: () => void
  onRemove: () => void
  onToggleSung: () => void
}

/**
 * One Bible passage of a program. The verse counterpart of `ScheduleSongRow`,
 * kept structurally identical — done-marker, reference, project-on-click, open,
 * remove — so the Programe panel reads the same whatever it is listing.
 */
export function ScheduleVerseRow({
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

  const getRowClass = () => {
    if (isDragging) {
      return 'opacity-80 shadow-lg border-teal-400 dark:border-teal-500 bg-teal-50 dark:bg-teal-900/20'
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
    return 'border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/10'
  }

  // The stored reference already carries the translation suffix
  // ("Ioan 3:16 - VDCC"); strip it so the badge can show it separately.
  const reference =
    item.biblePassageReference?.split(' - ')[0] ??
    item.biblePassageVerses[0]?.reference ??
    ''

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        if (rowRef) rowRef.current = node
      }}
      style={style}
      data-testid="schedule-verse-item"
      className={`flex items-center gap-1 rounded-lg border transition-colors ${getRowClass()}`}
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

      <ScheduleSungToggle
        isSung={item.isSung}
        onToggle={onToggleSung}
        variant="read"
        testId="schedule-verse-read-toggle"
      />

      <button
        type="button"
        onClick={onPresent}
        title={t('panel.presentItem')}
        data-testid="schedule-verse-present"
        className="flex-1 min-w-0 text-left py-1.5 pr-1 pl-1"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ScheduleItemTypeIcon item={item} size="sm" />
          <span className="text-sm font-medium truncate text-gray-900 dark:text-white">
            {reference}
          </span>
          {item.biblePassageTranslation && (
            <span className="shrink-0 text-[10px] font-medium text-teal-600 dark:text-teal-400">
              {item.biblePassageTranslation}
            </span>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-teal-500 dark:hover:text-teal-400 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
        title={t('panel.openPassage')}
        data-testid="schedule-verse-open"
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
          data-testid="schedule-verse-edit"
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
        data-testid="schedule-verse-remove"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}
