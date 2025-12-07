import { ChevronDown, ChevronRight, GripVertical, Music } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  QueueItemContextMenu,
  type QueueItemContextMenuHandle,
} from './QueueItemContextMenu'
import { QueueSlidePreview } from './QueueSlidePreview'
import type { QueueItem, SlideTemplate } from '../types'

interface QueueSongItemProps {
  item: QueueItem
  isExpanded: boolean
  activeSlideId: number | null
  activeQueueItemId: number | null
  onToggleExpand: () => void
  onRemove: () => void
  onSlideClick: (slideId: number) => void
  onSongClick: () => void
  onEditSong: () => void
  onInsertSongAfter: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function QueueSongItem({
  item,
  isExpanded,
  activeSlideId,
  activeQueueItemId,
  onToggleExpand,
  onRemove,
  onSlideClick,
  onSongClick,
  onEditSong,
  onInsertSongAfter,
  onInsertSlideAfter,
  dragHandleProps,
}: QueueSongItemProps) {
  const { t } = useTranslation('queue')
  const contextMenuRef = useRef<QueueItemContextMenuHandle>(null)

  // Only highlight if this specific queue item is active
  const isThisQueueItemActive = item.id === activeQueueItemId
  const isAnySlideActive =
    isThisQueueItemActive &&
    item.slides.some((slide) => slide.id === activeSlideId)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    contextMenuRef.current?.openMenu()
  }

  return (
    <div
      className={`rounded-lg border transition-all ${
        isAnySlideActive
          ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Song Header */}
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

        {/* Song Icon & Title - Clickable to select first slide */}
        <button
          type="button"
          onClick={onSongClick}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isAnySlideActive
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Music size={16} />
          </div>

          {/* Song Title & Info */}
          <div className="flex-1 min-w-0">
            <div
              className={`font-medium text-sm truncate ${
                isAnySlideActive
                  ? 'text-indigo-900 dark:text-indigo-100'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {item.song?.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {item.slides.length} slides
              {item.song?.categoryName && ` • ${item.song.categoryName}`}
            </div>
          </div>
        </button>

        {/* Context Menu */}
        <QueueItemContextMenu
          ref={contextMenuRef}
          onEditSong={onEditSong}
          onInsertSongAfter={onInsertSongAfter}
          onInsertSlideAfter={onInsertSlideAfter}
          onRemove={onRemove}
        />
      </div>

      {/* Expanded Slides */}
      {isExpanded && item.slides.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {item.slides.map((slide, idx) => (
            <QueueSlidePreview
              key={slide.id}
              slide={slide}
              slideIndex={idx}
              isActive={isThisQueueItemActive && slide.id === activeSlideId}
              onClick={() => onSlideClick(slide.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
