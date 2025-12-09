import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Music,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem, SlideTemplate } from '../types'

interface ScheduleItemSongProps {
  item: ScheduleItem
  onRemove: () => void
  onEditSong: () => void
  onInsertSongAfter: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ScheduleItemSong({
  item,
  onRemove,
  onEditSong,
  onInsertSongAfter,
  onInsertSlideAfter,
  dragHandleProps,
}: ScheduleItemSongProps) {
  const { t } = useTranslation('queue')
  const [isExpanded, setIsExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Song Header */}
      <div className="flex items-center gap-2 p-3">
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
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title={isExpanded ? t('actions.collapse') : t('actions.expand')}
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-gray-500" />
          ) : (
            <ChevronRight size={16} className="text-gray-500" />
          )}
        </button>

        {/* Song Icon & Title - Clickable to edit */}
        <button
          type="button"
          onClick={onEditSong}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center">
            <Music size={16} />
          </div>

          {/* Song Title & Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate text-gray-900 dark:text-white">
              {item.song?.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {item.slides.length} slides
              {item.song?.categoryName && ` • ${item.song.categoryName}`}
            </div>
          </div>
        </button>

        {/* Context Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MoreVertical size={16} className="text-gray-500" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onEditSong()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Pencil size={14} />
                  {t('actions.editSong')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onInsertSongAfter()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Plus size={14} />
                  {t('actions.insertAfter')}
                </button>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onRemove()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} />
                  {t('actions.remove')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expanded Slides */}
      {isExpanded && item.slides.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {item.slides.map((slide, idx) => (
            <div
              key={slide.id}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="text-gray-600 dark:text-gray-400 line-clamp-1">
                {slide.content.replace(/<[^>]*>/g, '').substring(0, 60)}
                {slide.content.length > 60 ? '...' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
