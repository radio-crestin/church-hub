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

import { removeHtmlTags } from '~/utils/removeHtmlTags'
import type { ScheduleItem } from '../types'

interface ScheduleItemSongProps {
  item: ScheduleItem
  onRemove: () => void
  onEditSong: () => void
  onInsertSongAfter: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ScheduleItemSong({
  item,
  onRemove,
  onEditSong,
  onInsertSongAfter,
  dragHandleProps,
}: ScheduleItemSongProps) {
  const { t } = useTranslation('queue')
  const [isExpanded, setIsExpanded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rounded-lg border border-line bg-panel">
      {/* Song Header */}
      <div className="flex items-center gap-2 p-3">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-hover"
        >
          <GripVertical size={16} className="text-fg-hint" strokeWidth={1.5} />
        </div>

        {/* Expand/Collapse */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-shrink-0 p-1 rounded hover:bg-hover"
          title={isExpanded ? t('actions.collapse') : t('actions.expand')}
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-fg-hint" strokeWidth={1.5} />
          ) : (
            <ChevronRight
              size={16}
              className="text-fg-hint"
              strokeWidth={1.5}
            />
          )}
        </button>

        {/* Song Icon & Title - Clickable to edit */}
        <button
          type="button"
          onClick={onEditSong}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
            <Music size={16} className="text-fg-label" strokeWidth={1.5} />
          </div>

          {/* Song Title & Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate text-fg">
              {item.song?.title}
            </div>
            <div className="text-xs text-fg-hint">
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
            className="p-1 rounded hover:bg-hover"
          >
            <MoreVertical
              size={16}
              className="text-fg-hint"
              strokeWidth={1.5}
            />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-panel border border-line rounded-lg shadow-lg py-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onEditSong()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-body hover:bg-hover"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                  {t('actions.editSong')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onInsertSongAfter()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-body hover:bg-hover"
                >
                  <Plus size={14} strokeWidth={1.75} />
                  {t('actions.insertAfter')}
                </button>
                <hr className="my-1 border-line" />
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onRemove()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
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
              className="flex items-center gap-2 px-3 py-2 bg-app rounded-lg text-sm"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded bg-field text-fg-label text-xs flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="text-fg-label line-clamp-1">
                {removeHtmlTags(slide.content).substring(0, 60)}
                {slide.content.length > 60 ? '...' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
