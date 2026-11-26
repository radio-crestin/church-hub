import {
  Book,
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem, SlideTemplate } from '../types'

interface ScheduleItemBiblePassageProps {
  item: ScheduleItem
  onRemove: () => void
  onInsertSongAfter: () => void
  onInsertSlideAfter?: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ScheduleItemBiblePassage({
  item,
  onRemove,
  onInsertSongAfter,
  dragHandleProps,
}: ScheduleItemBiblePassageProps) {
  const { t } = useTranslation('queue')
  const [showMenu, setShowMenu] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rounded-lg border border-line bg-panel">
      {/* Passage Header */}
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

        {/* Passage Icon & Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
            <Book size={16} className="text-fg-label" strokeWidth={1.5} />
          </div>

          {/* Passage Reference & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate text-fg">
                {item.biblePassageReference || t('biblePassage.passage')}
              </span>
            </div>
            <div className="text-xs text-fg-hint">
              {t('biblePassage.versesCount', {
                count: item.biblePassageVerses.length,
              })}
            </div>
          </div>
        </div>

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

      {/* Expanded Verses */}
      {isExpanded && item.biblePassageVerses.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {item.biblePassageVerses.map((verse) => (
            <div key={verse.id} className="p-2 rounded bg-field text-sm">
              <div className="font-medium text-xs mb-1 text-fg">
                {verse.reference}
              </div>
              <div className="text-fg-label line-clamp-2">{verse.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
