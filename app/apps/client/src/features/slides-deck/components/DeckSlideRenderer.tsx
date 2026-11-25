import { useMemo, useRef } from 'react'

import { DeckSlideStage } from './DeckSlideStage'
import { useDeckSlideAnimations } from '../hooks/useDeckSlideAnimations'
import type { DeckShownSlide } from '../types'
import { deckTargetStates } from '../utils/deckTargetStates'
import { slideTimeline } from '../utils/slideTimeline'

interface DeckSlideRendererProps {
  shown: DeckShownSlide
  containerWidth: number
  containerHeight: number
  /** Its videos play their sound here (a main display, not a preview). */
  withSound: boolean
  /** False while the presentation is being hidden: it fades out. */
  isVisible: boolean
}

const LAYER: React.CSSProperties = { position: 'absolute', inset: 0 }

/**
 * A Slides item's slide on a screen: the deck's design size scaled to fit,
 * centred with black bars, drawn as its step leaves it, with its transition
 * and click groups played as they come (useDeckSlideAnimations). Every
 * screen and preview draws it here, through usePresentationContent, so they
 * all show the same.
 */
export function DeckSlideRenderer({
  shown,
  containerWidth,
  containerHeight,
  withSound,
  isVisible,
}: DeckSlideRendererProps) {
  const currentRef = useRef<HTMLDivElement>(null)
  const previousRef = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => slideTimeline(shown.slide), [shown.slide])
  const states = useMemo(
    () => deckTargetStates(groups, shown.buildIndex),
    [groups, shown.buildIndex],
  )
  const showsPrevious = useDeckSlideAnimations({
    shown,
    groups,
    currentRef,
    previousRef,
  })

  const scale = Math.min(
    containerWidth / shown.width,
    containerHeight / shown.height,
  )
  const boxWidth = shown.width * scale
  const boxHeight = shown.height * scale
  const previous = showsPrevious ? shown.previous : null

  return (
    <div
      data-testid="deck-slide"
      data-slide-index={shown.slideIndex}
      data-build-index={shown.buildIndex}
      className="absolute inset-0 overflow-hidden bg-black transition-opacity duration-200"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div
        data-testid="deck-slide-box"
        className="absolute overflow-hidden"
        style={{
          left: (containerWidth - boxWidth) / 2,
          top: (containerHeight - boxHeight) / 2,
          width: boxWidth,
          height: boxHeight,
        }}
      >
        {previous && (
          <div ref={previousRef} style={LAYER} aria-hidden="true">
            <DeckSlideStage
              slide={previous.slide}
              width={previous.width}
              height={previous.height}
              scale={boxWidth / previous.width}
              states={deckTargetStates(
                slideTimeline(previous.slide),
                previous.buildIndex,
              )}
              playMedia={false}
              withSound={false}
            />
          </div>
        )}
        <div ref={currentRef} style={LAYER}>
          <DeckSlideStage
            slide={shown.slide}
            width={shown.width}
            height={shown.height}
            scale={scale}
            states={states}
            playMedia
            withSound={withSound}
          />
        </div>
      </div>
    </div>
  )
}
