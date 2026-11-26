import { Film } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BackgroundMediaThumbnail } from '~/features/background-media/components/BackgroundMediaThumbnail'
import type { ScheduleItem } from '../types'
import type { PresentedScheduleInfo } from '../utils/presentedScheduleInfo'

interface VideoStepRowProps {
  item: ScheduleItem
  presentedInfo: PresentedScheduleInfo | null
  /** Where this item sits in the presentation's running order. */
  itemStartFlatIndex: number
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  onVideoClick?: (item: ScheduleItem) => void
}

/** A video item's one step: its video this run, played full screen. */
export function VideoStepRow({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onVideoClick,
}: VideoStepRowProps) {
  const { t } = useTranslation('schedules')
  if (!item.video) {
    return (
      <p className="px-3 py-2 text-[13px] text-amber-700 dark:text-amber-300">
        {t('mediaItems.video.noVideos')}
      </p>
    )
  }
  const isPresented =
    presentedInfo?.type === 'video' &&
    presentedInfo.scheduleItemIndex === itemStartFlatIndex

  return (
    <button
      ref={isPresented ? highlightedRef : null}
      type="button"
      data-testid={`schedule-sub-item-${itemStartFlatIndex}`}
      onClick={() => onVideoClick?.(item)}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
        isPresented
          ? 'bg-live-tint ring-1 ring-inset ring-live'
          : 'hover:bg-hover'
      }`}
    >
      <span className="h-10 w-16 shrink-0 overflow-hidden rounded bg-black">
        <BackgroundMediaThumbnail
          media={{
            id: item.video.mediaId,
            kind: 'video',
            mimeType: '',
            size: 0,
            url: item.video.url,
            createdAt: 0,
          }}
        />
      </span>
      <Film
        size={16}
        strokeWidth={1.5}
        className={`shrink-0 ${isPresented ? 'text-fg-label' : 'text-fg-hint'}`}
      />
      <span
        className={`text-[13px] ${isPresented ? 'text-fg' : 'text-fg-body'}`}
      >
        {t('mediaItems.video.playFullScreen')}
      </span>
    </button>
  )
}
