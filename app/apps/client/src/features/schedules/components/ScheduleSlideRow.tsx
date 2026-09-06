import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { stripHtmlTags } from '~/features/songs/utils/stripHtmlTags'
import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { ScheduleSungToggle } from './ScheduleSungToggle'
import type { ScheduleItem } from '../types'

interface ScheduleSlideRowProps {
  item: ScheduleItem
  /** The program is showing this slide right now. */
  isLive?: boolean
  /** Drag-to-reorder, hidden while a search narrows the panel. */
  isSortable: boolean
  /** Scroll anchor, attached to the live row so the panel can follow along. */
  rowRef?: React.RefObject<HTMLDivElement | null>
  /** Projects this slide (its first entry, for Versete Tineri). */
  onPresent?: () => void
  /** Flips the done-marker — announcements and scenes get ticked off too. */
  onToggleSung?: () => void
  /** Opens the program page's slide editor for this item. */
  onEdit?: () => void
  /** Drops the slide from the program. */
  onRemove?: () => void
}

/**
 * The compact Programe row for a program's standalone slides — an
 * announcement, a Versete Tineri block, an OBS scene.
 *
 * They have no page of their own to open, so the row is a done-marker, an icon,
 * a label, and a click that puts the slide on screen.
 */
export function ScheduleSlideRow({
  item,
  isLive = false,
  isSortable,
  rowRef,
  onPresent,
  onToggleSung,
  onEdit,
  onRemove,
}: ScheduleSlideRowProps) {
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

  const { label, testId } = (() => {
    if (item.slideType === 'versete_tineri') {
      return {
        label:
          item.verseteTineriEntries.length > 0
            ? item.verseteTineriEntries
                // The name is optional now, so a reading with nobody attached
                // shows just its reference rather than a dangling dash.
                .map((entry) =>
                  entry.personName.trim()
                    ? `${entry.personName} – ${entry.reference}`
                    : entry.reference,
                )
                .join(', ')
            : t('presenter.verseteTineri'),
        testId: 'schedule-versete-tineri-item',
      }
    }
    if (item.slideType === 'scene') {
      return {
        label:
          item.slideContent || item.obsSceneName || t('slideTemplates.scene'),
        testId: 'schedule-scene-item',
      }
    }
    return {
      label:
        stripHtmlTags(item.slideContent || '') || t('presenter.announcement'),
      testId: 'schedule-announcement-item',
    }
  })()

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        if (rowRef) rowRef.current = node
      }}
      style={style}
      data-testid={testId}
      className={`flex items-center gap-1 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-80 shadow-lg border-orange-400 bg-orange-50 dark:border-orange-500 dark:bg-orange-900/20'
          : isLive
            ? 'border-orange-400 bg-orange-50 ring-2 ring-inset ring-orange-500 dark:border-orange-500 dark:bg-orange-900/30'
            : item.isSung
              ? 'border-green-200 bg-green-50/50 hover:border-green-300 dark:border-green-800/60 dark:bg-green-900/10 dark:hover:border-green-700'
              : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600 dark:hover:bg-orange-900/10'
      }`}
    >
      {isSortable ? (
        <div
          {...attributes}
          {...listeners}
          data-testid="schedule-slide-drag-handle"
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
      {onToggleSung ? (
        <ScheduleSungToggle
          isSung={item.isSung}
          onToggle={onToggleSung}
          testId="schedule-slide-sung-toggle"
        />
      ) : null}
      <button
        type="button"
        onClick={onPresent}
        title={t('panel.presentItem')}
        data-testid="schedule-slide-present"
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-1 pr-2 text-left"
      >
        <ScheduleItemTypeIcon item={item} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
          {label}
        </span>
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
          data-testid="schedule-slide-edit"
        >
          <Pencil size={14} />
        </button>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-r-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title={t('panel.removeFromSchedule')}
          data-testid="schedule-slide-remove"
        >
          <XIcon size={14} />
        </button>
      ) : null}
    </div>
  )
}
