import { Book, Camera, Loader2, Megaphone, Music, User, X } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useClearTemporaryContent } from '~/features/presentation'
import { useFollowPresentedScroll } from '~/hooks/useFollowPresentedScroll'
import { ScheduleItemSubItems } from './ScheduleItemSubItems'
import type { ScheduleFlatNavigation } from '../hooks/useScheduleFlatNavigation'
import type { ScheduleItem } from '../types'

interface ScheduleLiveItemPanelProps {
  /** The program walk this panel follows. */
  nav: ScheduleFlatNavigation
  className?: string
}

/** Icon + heading for the program item currently on screen. */
function describeItem(
  item: ScheduleItem,
  t: (key: string) => string,
): { icon: React.ReactNode; title: string } {
  if (item.itemType === 'song') {
    return {
      icon: <Music size={14} className="text-indigo-500" />,
      title: item.song?.title ?? '',
    }
  }
  if (item.itemType === 'bible_passage') {
    return {
      icon: <Book size={14} className="text-teal-500" />,
      title: item.biblePassageReference ?? '',
    }
  }
  if (item.slideType === 'versete_tineri') {
    return {
      icon: <User size={14} className="text-green-500" />,
      title: t('presenter.verseteTineri'),
    }
  }
  if (item.slideType === 'scene') {
    return {
      icon: <Camera size={14} className="text-violet-500" />,
      title:
        item.slideContent || item.obsSceneName || t('slideTemplates.scene'),
    }
  }
  return {
    icon: <Megaphone size={14} className="text-orange-500" />,
    title: t('presenter.announcement'),
  }
}

/**
 * The left rail while a program is running: the ONE program item that is on
 * screen right now, opened to its presentable steps with the live one ringed
 * green. Clicking a step jumps the program there.
 *
 * It replaces the song's own verse list precisely because the operator's place
 * has moved on — once the program reaches a reading or an announcement, the
 * song they happened to have open is no longer what they are following.
 */
export function ScheduleLiveItemPanel({
  nav,
  className = '',
}: ScheduleLiveItemPanelProps) {
  const { t } = useTranslation('schedules')
  const clearTemporary = useClearTemporaryContent()
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightedRef = useRef<HTMLButtonElement>(null)

  // Follows the projector exactly like the program page's list does.
  useFollowPresentedScroll(containerRef, highlightedRef, nav.currentFlatIndex)

  const liveItem = nav.flatItems[nav.currentFlatIndex]?.item
  if (!liveItem) return null

  const { icon, title } = describeItem(liveItem, t)

  return (
    <div
      className={`flex h-full flex-col overflow-hidden ${className}`}
      data-testid="schedule-live-item-panel"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
        {icon}
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white"
          data-testid="schedule-live-item-title"
        >
          {title}
        </span>
        {/* Leaving the program lives here, beside the thing it dismisses,
            rather than in the preview: this rail is what took the column, so
            this is where the operator looks to get it back. */}
        <button
          type="button"
          onClick={() => clearTemporary.mutate()}
          disabled={clearTemporary.isPending}
          data-testid="schedule-live-item-stop"
          className="flex shrink-0 items-center justify-center rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          title={t('panel.stopLiveItem')}
          aria-label={t('panel.stopLiveItem')}
        >
          {clearTemporary.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <X size={14} />
          )}
        </button>
      </div>

      <div
        ref={containerRef}
        className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin py-1 pl-1 pr-2"
      >
        <ScheduleItemSubItems
          item={liveItem}
          presentedInfo={nav.presentedInfo}
          itemStartFlatIndex={nav.itemStartFlatIndex[liveItem.id] ?? 0}
          highlightedRef={highlightedRef}
          onSlideClick={nav.presentSongSlide}
          onVerseClick={nav.presentPassageVerse}
          onEntryClick={nav.presentVerseteEntry}
          onAnnouncementClick={nav.presentAnnouncement}
          onSceneClick={nav.presentScene}
        />
      </div>
    </div>
  )
}
