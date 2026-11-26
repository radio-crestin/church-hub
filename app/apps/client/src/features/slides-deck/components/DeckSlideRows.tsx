import { MoreVertical } from 'lucide-react'
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
  /** Opens the slide `slideIndex` in the editor (a double click, its ⋮). */
  onEdit?: (slideIndex: number) => void
}

/**
 * A Slides item's slides, one row each: drawn small, its number and first
 * words. A click puts the slide up as it comes in; the row lights while any
 * of its clicks is on screen; a double click or its ⋮ opens it in the editor.
 */
export function DeckSlideRows({
  deck,
  itemStartFlatIndex,
  presentedFlatIndex,
  highlightedRef,
  onStepClick,
  onEdit,
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
          <div key={slide.id} className="group relative">
            <button
              ref={isPresented ? highlightedRef : null}
              type="button"
              data-testid={`schedule-sub-item-${flatIndex}`}
              data-presented={isPresented || undefined}
              onClick={() => onStepClick?.(firstStep)}
              onDoubleClick={() => onEdit?.(slideIndex)}
              className={`flex w-full items-center gap-3 rounded-lg py-2 pr-10 pl-3 text-left transition-colors ${
                isPresented
                  ? 'bg-live-tint ring-1 ring-inset ring-live'
                  : 'hover:bg-hover'
              }`}
            >
              <DeckSlideThumbnail
                slide={slide}
                width={deck.width}
                height={deck.height}
                boxWidth={THUMBNAIL_WIDTH}
              />
              <span
                className={`w-5 shrink-0 text-xs font-semibold tabular-nums ${
                  isPresented ? 'text-live' : 'text-fg-hint'
                }`}
              >
                {slideIndex + 1}
              </span>
              <span
                className={`line-clamp-2 min-w-0 text-sm ${
                  isPresented ? 'text-fg' : 'text-fg-body'
                }`}
              >
                {deckSlideText(slide) || t('slidesDeck.untitledSlide')}
              </span>
            </button>
            {onEdit && (
              <button
                type="button"
                data-testid={`deck-slide-edit-${slideIndex}`}
                title={t('slidesDeck.editSlide')}
                aria-label={t('slidesDeck.editSlide')}
                onClick={() => onEdit(slideIndex)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-fg-hint hover:bg-hover hover:text-fg"
              >
                <MoreVertical size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}
