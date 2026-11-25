import { useTranslation } from 'react-i18next'

import { DeckSlideThumbnail } from './DeckSlideThumbnail'
import type { SlideDeck } from '../types'
import { deckSlideText } from '../utils/deckSlideText'
import { deckSteps } from '../utils/deckSteps'

const THUMBNAIL_WIDTH = 64

interface DeckSlideRowsProps {
  deck: SlideDeck
  /** Where the deck starts in the presentation's running order. */
  itemStartFlatIndex: number
  /** The running order's step on screen, when it is this presentation's. */
  presentedFlatIndex: number | null
  /** Attached to the presented row so the list can scroll it into view. */
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  /** Puts the deck's step `stepIndex` up (a slide's first step). */
  onStepClick?: (stepIndex: number) => void
}

/**
 * A Slides item's slides, one row each: drawn small, its number and first
 * words. A click puts the slide up as it comes in; the row lights while any
 * of its clicks is on screen.
 */
export function DeckSlideRows({
  deck,
  itemStartFlatIndex,
  presentedFlatIndex,
  highlightedRef,
  onStepClick,
}: DeckSlideRowsProps) {
  const { t } = useTranslation('schedules')
  const steps = deckSteps(deck)
  if (deck.slides.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
        {t('slidesDeck.noSlides')}
      </p>
    )
  }
  return (
    <>
      {deck.slides.map((slide, slideIndex) => {
        const firstStep = steps.findIndex((s) => s.slideIndex === slideIndex)
        const presentedStep =
          presentedFlatIndex === null
            ? -1
            : presentedFlatIndex - itemStartFlatIndex
        const isPresented = steps[presentedStep]?.slideIndex === slideIndex
        const flatIndex = itemStartFlatIndex + firstStep
        return (
          <button
            key={slide.id}
            ref={isPresented ? highlightedRef : null}
            type="button"
            data-testid={`schedule-sub-item-${flatIndex}`}
            data-presented={isPresented || undefined}
            onClick={() => onStepClick?.(firstStep)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
              isPresented
                ? 'bg-green-100 ring-2 ring-green-500 ring-inset dark:bg-green-900/50'
                : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/50 dark:hover:bg-gray-700'
            }`}
          >
            <DeckSlideThumbnail
              slide={slide}
              width={deck.width}
              height={deck.height}
              boxWidth={THUMBNAIL_WIDTH}
            />
            <span className="w-5 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {slideIndex + 1}
            </span>
            <span className="line-clamp-2 min-w-0 text-sm text-gray-700 dark:text-gray-300">
              {deckSlideText(slide) || t('slidesDeck.untitledSlide')}
            </span>
          </button>
        )
      })}
    </>
  )
}
