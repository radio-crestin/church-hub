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
      <p className="px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
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
          ? 'bg-sky-100 dark:bg-sky-900/50 ring-2 ring-inset ring-sky-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
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
      <Film size={16} className="shrink-0 text-sky-500" />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {t('mediaItems.video.playFullScreen')}
      </span>
    </button>
  )
}
