import { Book, GripVertical } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  QueueItemContextMenu,
  type QueueItemContextMenuHandle,
} from './QueueItemContextMenu'
import type { QueueItem, SlideTemplate } from '../types'

interface QueueBibleItemProps {
  item: QueueItem
  isActive: boolean
  onRemove: () => void
  onClick: () => void
  onInsertSongAfter: () => void
  onInsertBibleVerseAfter?: () => void
  onInsertBiblePassageAfter?: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function QueueBibleItem({
  item,
  isActive,
  onRemove,
  onClick,
  onInsertSongAfter,
  onInsertBibleVerseAfter,
  onInsertBiblePassageAfter,
  onInsertSlideAfter,
  dragHandleProps,
}: QueueBibleItemProps) {
  const { t } = useTranslation('queue')
  const contextMenuRef = useRef<QueueItemContextMenuHandle>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    contextMenuRef.current?.openMenu()
  }

  return (
    <div
      className={`rounded-lg border transition-all ${
        isActive
          ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
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

        {/* Bible Icon & Content */}
        <button
          type="button"
          onClick={onClick}
          className="flex-1 flex items-center gap-3 min-w-0 text-left"
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isActive
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Book size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium text-sm ${
                  isActive
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {item.bibleReference || t('bible.verse')}
              </span>
              {item.bibleTranslation && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {item.bibleTranslation}
                </span>
              )}
            </div>
            {item.bibleText && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {item.bibleText}
              </div>
            )}
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
    </div>
  )
}
