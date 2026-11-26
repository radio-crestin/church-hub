import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MonitorPlay, Pencil, X as XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { ScheduleKeyLineChip } from './ScheduleKeyLineChip'
import { ScheduleRowNumber } from './ScheduleRowNumber'
import { ScheduleSungToggle } from './ScheduleSungToggle'
import { scheduleRowClass } from './scheduleRowClass'
import type { ScheduleItem } from '../types'

interface ScheduleSongRowProps {
  item: ScheduleItem
  /** Highlights the song currently open on the song page. */
  isActive: boolean
  /** The program is showing a slide of this song right now. */
  isLive?: boolean
  /** Place in the program's running order, from 1. */
  position: number
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
  /** Opens the gama editor for this song. */
  onEditKeyLine?: () => void
  /** Absent without permission to edit the program. */
  onRemove?: () => void
  onToggleSung: () => void
}

/**
 * One song of a program: a row that opens the song when clicked.
 *
 * It carries the same identifying details as a Marcaje row — title, category,
 * key line and tags — so a song reads the same wherever it is listed. Which
 * verse goes up is still chosen on the left of the page — the slide rail — so
 * this list stays a readable running order rather than a second, competing
 * verse picker.
 *
 * Opening and projecting are kept apart on purpose: walking the running order
 * to read a song must not put it on the screen, so the body only navigates and
 * the monitor button is the single way to project.
 */
export function ScheduleSongRow({
  item,
  isActive,
  isLive = false,
  position,
  isSortable,
  rowRef,
  onPresent,
  onSelect,
  onEdit,
  onEditKeyLine,
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
      ref={(node) => {
        setNodeRef(node)
        if (rowRef) rowRef.current = node
      }}
      style={style}
      data-testid="schedule-song-item"
      className={`flex items-center gap-1 rounded-lg transition-colors ${scheduleRowClass({ isDragging, isLive, isActive })}`}
    >
      {isSortable ? (
        <div
          {...attributes}
          {...listeners}
          data-testid="schedule-song-drag-handle"
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
        testId="schedule-song-sung-toggle"
      />

      {/* The row body opens the song. It mirrors the Marcaje row: title, then
          the song's category, then its tags; the gama sits beside it. */}
      <button
        type="button"
        onClick={onSelect}
        title={t('panel.openSong')}
        data-testid="schedule-song-open"
        className="flex-1 min-w-0 text-left py-1.5 pr-1 pl-1"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <ScheduleRowNumber position={position} isLive={isLive} />
          <ScheduleItemTypeIcon item={item} size="sm" />
          <span className="truncate text-sm font-medium text-fg">
            {song.title}
          </span>
        </div>
        {song.categoryName && (
          <div className="mt-0.5 truncate text-xs text-fg-hint">
            {song.categoryName}
          </div>
        )}
        {song.tagNames.length > 0 && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
            {song.tagNames.map((name) => (
              <span key={name} className="text-xs text-fg-label">
                {name}
              </span>
            ))}
          </div>
        )}
      </button>

      <ScheduleKeyLineChip
        keyLine={item.keyLine}
        onEdit={onEditKeyLine}
        testId="schedule-song-key-line"
      />

      {onEdit ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="flex-shrink-0 p-1.5 text-fg-hint hover:text-fg rounded hover:bg-hover transition-colors"
          title={t('contextMenu.edit')}
          data-testid="schedule-song-edit"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
      ) : null}

      {onPresent ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onPresent()
          }}
          className="flex-shrink-0 p-1.5 text-fg-hint hover:text-fg-label rounded hover:bg-hover transition-colors"
          title={t('panel.presentItem')}
          data-testid="schedule-song-present"
        >
          <MonitorPlay size={14} strokeWidth={1.75} />
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
          data-testid="schedule-song-remove"
        >
          <XIcon size={14} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}
