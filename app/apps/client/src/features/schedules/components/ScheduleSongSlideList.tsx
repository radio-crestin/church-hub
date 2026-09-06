import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { stripHtmlTags } from '~/features/songs/utils/stripHtmlTags'
import type { ScheduleItem } from '../types'
import type { PresentedScheduleInfo } from '../utils/presentedScheduleInfo'

interface ScheduleSongSlideListProps {
  item: ScheduleItem
  presentedInfo: PresentedScheduleInfo | null
  /** Where this item starts in the program's flat run. */
  itemStartFlatIndex: number
  /** Attached to the presented row so the list can scroll it into view. */
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
}

/**
 * The slides of a program's song, chorus-expanded exactly the way the projector
 * expands them, so row N here is step N of the program. Shared by the program
 * page's item list and the Programe panel on the song/Bible pages.
 */
export function ScheduleSongSlideList({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onSlideClick,
}: ScheduleSongSlideListProps) {
  const { t } = useTranslation('schedules')

  const expandedSlides = useMemo(
    () => expandSongSlidesWithChoruses(item.slides),
    [item.slides],
  )

  if (expandedSlides.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
        <AlertTriangle
          size={16}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0"
        />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          {t('warnings.noSlides')}
        </span>
      </div>
    )
  }

  return (
    <>
      {expandedSlides.map((slide, index) => {
        // Matching on the flat index rather than the slide index is what keeps
        // the highlight right when the same song sits in the program twice.
        const isPresented =
          presentedInfo?.type === 'song' &&
          presentedInfo.scheduleItemIndex === itemStartFlatIndex + index

        const plainText = stripHtmlTags(slide.content)

        return (
          <button
            key={`${slide.id}-${index}`}
            ref={isPresented ? highlightedRef : null}
            type="button"
            data-testid={`schedule-sub-item-${itemStartFlatIndex + index}`}
            onClick={() => onSlideClick(item, index)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              isPresented
                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-inset ring-green-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`font-semibold text-sm min-w-[24px] ${
                  isPresented
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`text-sm whitespace-pre-line ${
                  isPresented
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {plainText}
              </span>
            </div>
            {slide.label && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-8 mt-1 block">
                {slide.label}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}
