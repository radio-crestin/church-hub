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

import { removeHtmlTags } from '~/utils/removeHtmlTags'
import type { ScheduleItem } from '../types'

interface ScheduleItemSlideProps {
  item: ScheduleItem
  onRemove: () => void
  onEditSlide: () => void
  onInsertSongAfter: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ScheduleItemSlide({
  item,
  onRemove,
  onEditSlide,
  onInsertSongAfter,
  dragHandleProps,
}: ScheduleItemSlideProps) {
  const { t } = useTranslation('queue')
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAnnouncement = item.slideType === 'announcement'
  const Icon = isAnnouncement ? Megaphone : FileText

  // Strip HTML and get preview
  const contentPreview = item.slideContent
    ? removeHtmlTags(item.slideContent).substring(0, 100)
    : undefined

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-2 p-3">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-hover"
        >
          <GripVertical size={16} className="text-fg-hint" strokeWidth={1.5} />
        </div>

        {/* Slide Icon & Content - Clickable to edit */}
        <button
          type="button"
          onClick={onEditSlide}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
            <Icon size={16} strokeWidth={1.5} className="text-fg-label" />
          </div>

          {/* Slide Content */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-fg">
              {t(`slideTemplates.${item.slideType}`)}
            </div>
            {contentPreview && (
              <div className="text-xs text-fg-hint truncate">
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
                    onEditSlide()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-body hover:bg-hover"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                  {t('actions.editSlide')}
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
    </div>
  )
}
