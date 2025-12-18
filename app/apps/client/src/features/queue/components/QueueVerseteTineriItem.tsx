import { ChevronDown, ChevronRight, GripVertical, Users } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  QueueItemContextMenu,
  type QueueItemContextMenuHandle,
} from './QueueItemContextMenu'
import { QueueVerseteTineriEntryPreview } from './QueueVerseteTineriEntryPreview'
import type { QueueItem, SlideTemplate } from '../types'

interface QueueVerseteTineriItemProps {
  item: QueueItem
  isExpanded: boolean
  activeEntryId: number | null
  activeQueueItemId: number | null
  onToggleExpand: () => void
  onRemove: () => void
  onEntryClick: (entryId: number) => void
  onItemClick: () => void
  onInsertSongAfter: () => void
  onInsertBibleVerseAfter?: () => void
  onInsertBiblePassageAfter?: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function QueueVerseteTineriItem({
  item,
  isExpanded,
  activeEntryId,
  activeQueueItemId,
  onToggleExpand,
  onRemove,
  onEntryClick,
  onItemClick,
  onInsertSongAfter,
  onInsertBibleVerseAfter,
  onInsertBiblePassageAfter,
  onInsertSlideAfter,
  dragHandleProps,
}: QueueVerseteTineriItemProps) {
  const { t } = useTranslation('queue')
  const contextMenuRef = useRef<QueueItemContextMenuHandle>(null)

  // Only highlight if this specific queue item is active
  const isThisQueueItemActive = item.id === activeQueueItemId
  const isAnyEntryActive =
    isThisQueueItemActive &&
    item.verseteTineriEntries.some((entry) => entry.id === activeEntryId)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    contextMenuRef.current?.openMenu()
  }

  return (
    <div
      className={`rounded-lg border transition-all ${
        isAnyEntryActive
          ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 p-3"
        onContextMenu={handleContextMenu}
      >
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <GripVertical
            size={16}
            className="text-gray-400 dark:text-gray-500"
          />
        </div>

        {/* Expand/Collapse */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title={isExpanded ? t('actions.collapse') : t('actions.expand')}
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-gray-500" />
          ) : (
            <ChevronRight size={16} className="text-gray-500" />
          )}
        </button>

        {/* Icon & Title - Clickable to select first entry */}
        <button
          type="button"
          onClick={onItemClick}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isAnyEntryActive
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Users size={16} />
          </div>

          {/* Title & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium text-sm truncate ${
                  isAnyEntryActive
                    ? 'text-purple-900 dark:text-purple-100'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {t('slideTemplates.versete_tineri')}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('verseteTineri.entriesCount', {
                count: item.verseteTineriEntries.length,
              })}
            </div>
          </div>
        </button>

        {/* Context Menu */}
        <QueueItemContextMenu
          ref={contextMenuRef}
          onInsertSongAfter={onInsertSongAfter}
          onInsertBibleVerseAfter={onInsertBibleVerseAfter}
          onInsertBiblePassageAfter={onInsertBiblePassageAfter}
          onInsertSlideAfter={onInsertSlideAfter}
          onRemove={onRemove}
        />
      </div>

      {/* Expanded Entries */}
      {isExpanded && item.verseteTineriEntries.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {item.verseteTineriEntries.map((entry, idx) => (
            <QueueVerseteTineriEntryPreview
              key={entry.id}
              entry={entry}
              entryIndex={idx}
              isActive={isThisQueueItemActive && entry.id === activeEntryId}
              onClick={() => onEntryClick(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
