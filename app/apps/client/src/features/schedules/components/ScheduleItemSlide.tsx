import {
  FileText,
  GripVertical,
  Megaphone,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ICON_COLOR_CLASSES } from '~/features/sidebar-config/constants'
import type { ScheduleItem, SlideTemplate } from '../types'

interface ScheduleItemSlideProps {
  item: ScheduleItem
  onRemove: () => void
  onEditSlide: () => void
  onInsertSongAfter: () => void
  onInsertSlideAfter: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ScheduleItemSlide({
  item,
  onRemove,
  onEditSlide,
  onInsertSongAfter,
  onInsertSlideAfter,
  dragHandleProps,
}: ScheduleItemSlideProps) {
  const { t } = useTranslation('queue')
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAnnouncement = item.slideType === 'announcement'
  const Icon = isAnnouncement ? Megaphone : FileText
  const colorClasses = isAnnouncement
    ? ICON_COLOR_CLASSES.orange
    : ICON_COLOR_CLASSES.green

  // Strip HTML and get preview
  const contentPreview = item.slideContent
    ?.replace(/<[^>]*>/g, '')
    .substring(0, 100)

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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

        {/* Slide Icon & Content - Clickable to edit */}
        <button
          type="button"
          onClick={onEditSlide}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClasses.bg}`}
          >
            <Icon size={16} className={colorClasses.text} />
          </div>

          {/* Slide Content */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 dark:text-white">
              {t(`slideTemplates.${item.slideType}`)}
            </div>
            {contentPreview && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {contentPreview}
              </div>
            )}
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
    </div>
  )
}
