import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useFollowPresentedScroll } from '~/hooks/useFollowPresentedScroll'
import { SlideCounter } from './SlideCounter'
import type { LocalSlide } from './SongSlideList'
import { type SongSlideRailItem, SongSlideRailList } from './SongSlideRailList'
import { expandDraftSlides } from '../utils/expandDraftSlides'

interface SongEditorSlideRailProps {
  /** The editor's draft slides — unsaved edits and all. */
  slides: LocalSlide[]
  /** Which slide is on the projector, or null. */
  presentedIndex: number | null
  /** Projects the slide at this (chorus-expanded) index. */
  onPresentSlide: (index: number) => void
  onPrevSlide: () => void
  onNextSlide: () => void
  canNavigatePrev: boolean
  canNavigateNext: boolean
}

/**
 * The editor's left rail: the song's verses as they read right now, click to
 * project, arrows to move on.
 *
 * It is driven by the editor's draft rather than by the saved song, so a verse
 * typed a second ago is already in the list. The rail's own numbering is what a
 * click projects, which is exactly right once the song is saved; with unsaved
 * structural edits the projector still shows the last saved slide at that
 * position, so the operator sees the same drift the Slides section shows.
 */
export function SongEditorSlideRail({
  slides,
  presentedIndex,
  onPresentSlide,
  onPrevSlide,
  onNextSlide,
  canNavigatePrev,
  canNavigateNext,
}: SongEditorSlideRailProps) {
  const { t } = useTranslation(['songs', 'bible'])
  const presentedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const expandedSlides = useMemo(() => expandDraftSlides(slides), [slides])

  const isOriginalSlide = useMemo(() => {
    const seen = new Set<number>()
    return expandedSlides.map((slide) => {
      if (seen.has(slide.id)) return false
      seen.add(slide.id)
      return true
    })
  }, [expandedSlides])

  const railItems = useMemo<SongSlideRailItem[]>(
    () =>
      expandedSlides.map((slide, index) => ({
        key: `${slide.id}-${index}`,
        content: slide.content,
        label: slide.label,
        isDuplicate: !isOriginalSlide[index],
      })),
    [expandedSlides, isOriginalSlide],
  )

  // Keep the projected verse in view, the way the program page's list does.
  useFollowPresentedScroll(containerRef, presentedRef, presentedIndex)

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      data-testid="song-editor-slide-rail"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('songs:editor.slides')}
        </span>
        <div className="flex items-center gap-1">
          <SlideCounter
            currentIndex={presentedIndex}
            total={expandedSlides.length}
          />
          <button
            type="button"
            onClick={onPrevSlide}
            disabled={!canNavigatePrev}
            title={t('bible:controls.prev')}
            aria-label={t('bible:controls.prev')}
            data-testid="song-editor-rail-prev"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={onNextSlide}
            disabled={!canNavigateNext}
            title={t('bible:controls.next')}
            aria-label={t('bible:controls.next')}
            data-testid="song-editor-rail-next"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2 py-2"
      >
        {expandedSlides.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('songs:editor.noSlides')}
          </p>
        ) : (
          <SongSlideRailList
            items={railItems}
            presentedIndex={presentedIndex}
            highlightedIndex={null}
            presentedRef={presentedRef}
            onSlideClick={onPresentSlide}
            testIdPrefix="song-editor-slide"
          />
        )}
      </div>
    </div>
  )
}
