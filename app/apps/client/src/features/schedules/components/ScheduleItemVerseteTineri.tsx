import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ICON_COLOR_CLASSES } from '~/features/sidebar-config/constants'
import type { ScheduleItem, SlideTemplate } from '../types'

interface ScheduleItemVerseteTineriProps {
  item: ScheduleItem
  onRemove: () => void
  onEditSlide: () => void
  onInsertSongAfter: () => void
  onInsertSlideAfter?: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ScheduleItemVerseteTineri({
  item,
  onRemove,
  onEditSlide,
  onInsertSongAfter,
  dragHandleProps,
}: ScheduleItemVerseteTineriProps) {
  const { t } = useTranslation('queue')
  const [showMenu, setShowMenu] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
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

        {/* Icon & Title - Clickable to edit */}
        <button
          type="button"
          onClick={onEditSlide}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${ICON_COLOR_CLASSES.green.bg}`}
          >
            <Users size={16} className={ICON_COLOR_CLASSES.green.text} />
          </div>

          {/* Title & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate text-gray-900 dark:text-white">
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
                    onEditSlide()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Pencil size={14} />
                  {t('actions.editSlide')}
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

      {/* Expanded Entries */}
      {isExpanded && item.verseteTineriEntries.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {item.verseteTineriEntries.map((entry) => (
            <div
              key={entry.id}
              className="p-2 rounded bg-gray-50 dark:bg-gray-700/50 text-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`font-medium ${ICON_COLOR_CLASSES.green.text}`}
                >
                  {entry.personName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {entry.reference}
                </span>
              </div>
              <div className="text-gray-600 dark:text-gray-300 line-clamp-2 text-xs">
                {entry.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
