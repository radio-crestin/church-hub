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
          ? 'bg-live-tint ring-1 ring-inset ring-live'
          : 'hover:bg-hover'
      }`}
    >
      <div className="flex items-start gap-2">
        <FileText
          size={16}
          className={`flex-shrink-0 mt-0.5 ${
            isPresented ? 'text-fg-label' : 'text-fg-hint'
          }`}
          strokeWidth={1.5}
        />
        <span
          className={`text-sm line-clamp-3 ${
            isPresented ? 'text-fg' : 'text-fg-body'
          }`}
        >
          {plainText}
        </span>
      </div>
    </button>
  )
}
