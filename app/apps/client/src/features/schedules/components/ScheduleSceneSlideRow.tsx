import { Camera } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem } from '../types'
import type { PresentedScheduleInfo } from '../utils/presentedScheduleInfo'

interface ScheduleSceneSlideRowProps {
  item: ScheduleItem
  presentedInfo: PresentedScheduleInfo | null
  /** Where this item sits in the program's flat run. */
  itemStartFlatIndex: number
  /** Attached to the presented row so the list can scroll it into view. */
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  onSceneClick?: (item: ScheduleItem) => void
}

/**
 * An OBS scene switch is a single presentable step (it also blanks the slide),
 * so it renders as one row. Shared by the program page's item list and the
 * Programe panel.
 */
export function ScheduleSceneSlideRow({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onSceneClick,
}: ScheduleSceneSlideRowProps) {
  const { t } = useTranslation('schedules')
  const isPresented =
    presentedInfo?.type === 'scene' &&
    presentedInfo.obsSceneName === item.obsSceneName

  return (
    <button
      ref={isPresented ? highlightedRef : null}
      type="button"
      data-testid={`schedule-sub-item-${itemStartFlatIndex}`}
      onClick={() => onSceneClick?.(item)}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
        isPresented
          ? 'bg-violet-100 dark:bg-violet-900/50 ring-2 ring-inset ring-violet-500'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <Camera
          size={16}
          className={`flex-shrink-0 ${
            isPresented
              ? 'text-violet-600 dark:text-violet-400'
              : 'text-gray-400'
          }`}
        />
        <span
          className={`text-sm ${
            isPresented
              ? 'text-violet-900 dark:text-violet-100'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {t('slideTemplates.scene')}: {item.slideContent || item.obsSceneName}
        </span>
      </div>
    </button>
  )
}
