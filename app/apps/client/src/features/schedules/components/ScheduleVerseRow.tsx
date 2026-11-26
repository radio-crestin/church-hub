import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Pencil, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { ScheduleRowNumber } from './ScheduleRowNumber'
import { ScheduleSungToggle } from './ScheduleSungToggle'
import { scheduleRowClass } from './scheduleRowClass'
import type { ScheduleItem } from '../types'

interface ScheduleVerseRowProps {
  item: ScheduleItem
  /** Highlights the passage currently open on the Bible page. */
  isActive: boolean
  /** The program is showing a verse of this passage right now. */
  isLive?: boolean
  /** Place in the program's running order, from 1. */
  position: number
  isSortable: boolean
  /** Scroll anchor, attached to the live row so the panel can follow along. */
  rowRef?: React.RefObject<HTMLDivElement | null>
  /** Projects this passage from its first verse. */
  onPresent?: () => void
  onSelect: () => void
  /** Opens the program page's editor for this item. */
  onEdit?: () => void
  /** Absent without permission to edit the program. */
  onRemove?: () => void
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
  position,
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
      className={`flex items-center gap-1 rounded-lg transition-colors ${scheduleRowClass({ isDragging, isLive, isActive })}`}
    >
      {isSortable ? (
        <div
          {...attributes}
          {...listeners}
          data-testid="schedule-verse-drag-handle"
          title={t('panel.dragToReorder')}
          className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing rounded-l-lg hover:bg-hover"
        >
          <GripVertical size={14} className="text-fg-hint" strokeWidth={1.75} />
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
          <ScheduleRowNumber position={position} isLive={isLive} />
          <ScheduleItemTypeIcon item={item} size="sm" />
          <span className="text-[13px] font-medium truncate text-fg">
            {reference}
          </span>
          {item.biblePassageTranslation && (
            <span className="shrink-0 text-xs text-fg-hint">
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
        className="flex-shrink-0 p-1.5 text-fg-hint hover:text-fg-label rounded hover:bg-hover transition-colors"
        title={t('panel.openPassage')}
        data-testid="schedule-verse-open"
      >
        <ExternalLink size={14} strokeWidth={1.75} />
      </button>

      {onEdit ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="flex-shrink-0 p-1.5 text-fg-hint hover:text-fg rounded hover:bg-hover transition-colors"
          title={t('contextMenu.edit')}
          data-testid="schedule-verse-edit"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="flex-shrink-0 p-1.5 text-fg-hint hover:text-red-500 dark:hover:text-red-400 rounded-r-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title={t('panel.removeFromSchedule')}
          data-testid="schedule-verse-remove"
        >
          <XIcon size={14} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}
