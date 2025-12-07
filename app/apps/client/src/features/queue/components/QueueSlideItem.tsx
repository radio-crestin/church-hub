import { FileText, GripVertical, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { QueueItemContextMenu } from './QueueItemContextMenu'
import type { QueueItem, SlideTemplate } from '../types'

interface QueueSlideItemProps {
  item: QueueItem
  isActive: boolean
  onRemove: () => void
  onClick: () => void
  onInsertSlideAfter: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

const TEMPLATE_ICONS: Record<SlideTemplate, typeof Megaphone> = {
  announcement: Megaphone,
  versete_tineri: FileText,
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

export function QueueSlideItem({
  item,
  isActive,
  onRemove,
  onClick,
  onInsertSlideAfter,
  dragHandleProps,
}: QueueSlideItemProps) {
  const { t } = useTranslation('queue')

  const Icon = item.slideType ? TEMPLATE_ICONS[item.slideType] : FileText
  const contentPreview = item.slideContent ? stripHtml(item.slideContent) : ''

  return (
    <div
      className={`rounded-lg border transition-all ${
        isActive
          ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Slide Header */}
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

        {/* Slide Icon & Content */}
        <button
          type="button"
          onClick={onClick}
          className="flex-1 flex items-center gap-3 min-w-0 text-left"
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Icon size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <div
              className={`font-medium text-sm ${
                isActive
                  ? 'text-indigo-900 dark:text-indigo-100'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {item.slideType && t(`slideTemplates.${item.slideType}`)}
            </div>
            {contentPreview && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {contentPreview}
              </div>
            )}
          </div>
        </button>

        {/* Context Menu */}
        <QueueItemContextMenu
          onInsertSlideAfter={onInsertSlideAfter}
          onRemove={onRemove}
        />
      </div>
    </div>
  )
}
