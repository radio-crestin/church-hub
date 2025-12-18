import { Book, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  QueueItemContextMenu,
  type QueueItemContextMenuHandle,
} from './QueueItemContextMenu'
import { QueueVersePreview } from './QueueVersePreview'
import type { QueueItem, SlideTemplate } from '../types'

interface QueueBiblePassageItemProps {
  item: QueueItem
  isExpanded: boolean
  activeVerseId: number | null
  activeQueueItemId: number | null
  onToggleExpand: () => void
  onRemove: () => void
  onVerseClick: (verseId: number) => void
  onPassageClick: () => void
  onInsertSongAfter: () => void
  onInsertBibleVerseAfter?: () => void
  onInsertBiblePassageAfter?: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function QueueBiblePassageItem({
  item,
  isExpanded,
  activeVerseId,
  activeQueueItemId,
  onToggleExpand,
  onRemove,
  onVerseClick,
  onPassageClick,
  onInsertSongAfter,
  onInsertBibleVerseAfter,
  onInsertBiblePassageAfter,
  onInsertSlideAfter,
  dragHandleProps,
}: QueueBiblePassageItemProps) {
  const { t } = useTranslation('queue')
  const contextMenuRef = useRef<QueueItemContextMenuHandle>(null)

  // Only highlight if this specific queue item is active
  const isThisQueueItemActive = item.id === activeQueueItemId
  const isAnyVerseActive =
    isThisQueueItemActive &&
    item.biblePassageVerses.some((verse) => verse.id === activeVerseId)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    contextMenuRef.current?.openMenu()
  }

  return (
    <div
      className={`rounded-lg border transition-all ${
        isAnyVerseActive
          ? 'border-teal-400 bg-teal-50/50 dark:bg-teal-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Passage Header */}
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

        {/* Passage Icon & Title - Clickable to select first verse */}
        <button
          type="button"
          onClick={onPassageClick}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isAnyVerseActive
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Book size={16} />
          </div>

          {/* Passage Reference & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium text-sm truncate ${
                  isAnyVerseActive
                    ? 'text-teal-900 dark:text-teal-100'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {item.biblePassageReference || t('biblePassage.passage')}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('biblePassage.versesCount', {
                count: item.biblePassageVerses.length,
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

      {/* Expanded Verses */}
      {isExpanded && item.biblePassageVerses.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {item.biblePassageVerses.map((verse, idx) => (
            <QueueVersePreview
              key={verse.id}
              verse={verse}
              verseIndex={idx}
              isActive={isThisQueueItemActive && verse.id === activeVerseId}
              onClick={() => onVerseClick(verse.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
