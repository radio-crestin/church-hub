import { FileText } from 'lucide-react'

import { stripHtmlTags } from '~/features/songs/utils/stripHtmlTags'
import type { ScheduleItem } from '../types'
import type { PresentedScheduleInfo } from '../utils/presentedScheduleInfo'

interface ScheduleAnnouncementSlideRowProps {
  item: ScheduleItem
  presentedInfo: PresentedScheduleInfo | null
  /** Where this item sits in the program's flat run. */
  itemStartFlatIndex: number
  /** Attached to the presented row so the list can scroll it into view. */
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  onAnnouncementClick: (item: ScheduleItem) => void
}

/**
 * An announcement is a single presentable step, so it renders as one row.
 * Shared by the program page's item list and the Programe panel.
 */
export function ScheduleAnnouncementSlideRow({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onAnnouncementClick,
}: ScheduleAnnouncementSlideRowProps) {
  const plainText = stripHtmlTags(item.slideContent || '')
  const isPresented =
    presentedInfo?.type === 'announcement' &&
    presentedInfo.scheduleItemIndex === itemStartFlatIndex

  return (
    <button
      ref={isPresented ? highlightedRef : null}
      type="button"
      data-testid={`schedule-sub-item-${itemStartFlatIndex}`}
      onClick={() => onAnnouncementClick(item)}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isPresented
          ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-inset ring-green-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <FileText
          size={16}
          className={`flex-shrink-0 mt-0.5 ${
            isPresented ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
          }`}
        />
        <span
          className={`text-sm line-clamp-3 ${
            isPresented
              ? 'text-green-900 dark:text-green-100'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {plainText}
        </span>
      </div>
    </button>
  )
}
