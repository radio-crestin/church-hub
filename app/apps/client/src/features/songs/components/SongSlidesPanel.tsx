import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import { SlideCounter } from './SlideCounter'
import { type SongSlideRailItem, SongSlideRailList } from './SongSlideRailList'
import { useFollowPresentedScroll } from '../../../hooks/useFollowPresentedScroll'
import { useFontScale } from '../../../hooks/useFontScale'
import { FontSizeButtons } from '../../../ui/button'
import { isTypingTarget } from '../../../utils/isTypingTarget'
import type { SongSlide, SongWithSlides } from '../types'
import { expandSongSlidesWithChoruses } from '../utils/expandSongSlides'

interface SongSlidesPanelProps {
  song: SongWithSlides
  presentedSlideIndex: number | null
  selectedSlideIndex: number
  isLoading: boolean
  onSlideClick: (slide: SongSlide, index: number) => void
  /** Preview mode: a single click stages instead of projecting. */
  previewMode?: boolean
  /** Index of the slide staged for preview (indigo, not yet projected). */
  stagedSlideIndex?: number | null
  /** Double-click handler (preview mode): projects the slide immediately. */
  onSlideDoubleClick?: (slide: SongSlide, index: number) => void
}

// Font size of the view-mode lyrics list; the base matches Tailwind's `text-sm`.
const SLIDE_FONT_BASE_REM = 0.875
const SLIDE_FONT_SCALE_KEY = 'song-slides-font-scale'

// Decode HTML entities the same way the live preview does, so the slide list
// shows real characters (e.g. an apostrophe) instead of raw codes like
// `&#039;`. Setting `textContent` does NOT decode entities, which is why the
// previous textarea-based approach left `&#039;` visible.

export function SongSlidesPanel({
  song,
  presentedSlideIndex,
  selectedSlideIndex,
  isLoading,
  onSlideClick,
  previewMode = false,
  stagedSlideIndex = null,
  onSlideDoubleClick,
}: SongSlidesPanelProps) {
  const fontScale = useFontScale(SLIDE_FONT_SCALE_KEY, SLIDE_FONT_BASE_REM)
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Expanded slides for view mode (auto-inserts choruses) and for presenting.
  const expandedSlides = useMemo(
    () => expandSongSlidesWithChoruses(song.slides),
    [song.slides],
  )

  // Track chorus duplicates for view mode
  const isOriginalSlide = useMemo(() => {
    const seen = new Set<number>()
    return expandedSlides.map((slide) => {
      if (seen.has(slide.id)) return false
      seen.add(slide.id)
      return true
    })
  }, [expandedSlides])

  // In preview mode the indigo highlight marks the staged slide (which can
  // coexist with a different live/green slide). Outside preview mode it marks
  // the keyboard-selected slide.
  const highlightedIndex = previewMode
    ? stagedSlideIndex
    : presentedSlideIndex === null
      ? selectedSlideIndex
      : null

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

  // Follows the projector exactly like the program page's list does.
  useFollowPresentedScroll(containerRef, highlightedRef, presentedSlideIndex)

  // Hand the keyboard to the live slide as well. Presenting opens the
  // projection window, which takes the keyboard as it appears; what the
  // control window gets back has to land on something in the page, or the
  // next arrow key goes nowhere until the operator clicks a slide. Never
  // taken from a field the operator is typing in.
  useEffect(() => {
    const element = highlightedRef.current
    if (!element) return
    if (isTypingTarget(document.activeElement)) return
    element.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentedSlideIndex])

  // Auto-scroll to selected slide (view mode)
  useEffect(() => {
    if (
      presentedSlideIndex === null &&
      selectedRef.current &&
      containerRef.current
    ) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [selectedSlideIndex, presentedSlideIndex])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-fg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-line shrink-0">
        <FontSizeButtons
          fontScale={fontScale}
          testIdPrefix="song-slides-font"
        />
        {/* Where the operator is in the song — the presented slide while this
            song is live, otherwise the one they have selected. */}
        <SlideCounter
          currentIndex={presentedSlideIndex ?? selectedSlideIndex ?? null}
          total={expandedSlides.length}
        />
      </div>

      {/* Slides */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden lg:overflow-y-auto scrollbar-thin py-1 pl-1 pr-2"
      >
        <SongSlideRailList
          items={railItems}
          presentedIndex={presentedSlideIndex}
          highlightedIndex={highlightedIndex}
          textStyle={fontScale.textStyle}
          presentedRef={highlightedRef}
          highlightedRef={selectedRef}
          onSlideClick={(index) => onSlideClick(expandedSlides[index], index)}
          onSlideDoubleClick={
            previewMode
              ? (index) => onSlideDoubleClick?.(expandedSlides[index], index)
              : undefined
          }
        />
      </div>
    </div>
  )
}
