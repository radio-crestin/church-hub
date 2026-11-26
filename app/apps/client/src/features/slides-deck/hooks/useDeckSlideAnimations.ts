import { type RefObject, useEffect, useLayoutEffect, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { applyParagraphStates } from '../animations/applyParagraphStates'
import { playClickGroup } from '../animations/playClickGroup'
import { transitionKeyframes } from '../animations/transitionKeyframes'
import type { DeckClickGroup, DeckShownSlide } from '../types'
import { deckTargetStates } from '../utils/deckTargetStates'

const logger = createLogger('app:slides-deck:animations')

interface UseDeckSlideAnimationsInput {
  shown: DeckShownSlide
  groups: DeckClickGroup[]
  /** The layer the shown slide is drawn in. */
  currentRef: RefObject<HTMLDivElement | null>
  /** The layer the slide before it is drawn in during its transition. */
  previousRef: RefObject<HTMLDivElement | null>
}

/** Whether a slide comes in with a transition over the one before it. */
export function hasTransition(shown: DeckShownSlide): boolean {
  const transition = shown.slide.transition
  return (
    shown.entry === 'enter' &&
    !!transition &&
    transition.effect !== 'none' &&
    transition.durationMs > 0
  )
}

/**
 * Plays a shown deck step with the Web Animations API, once per step
 * (`shown.key`): a slide coming in plays its transition, then its group 0; a
 * Down on the same slide plays its next click group. A step back, a jump or a
 * screen that just opened plays nothing: the slide is already drawn as the
 * step leaves it. Returns whether the slide before it is still drawn under
 * it (its transition is playing).
 */
export function useDeckSlideAnimations({
  shown,
  groups,
  currentRef,
  previousRef,
}: UseDeckSlideAnimationsInput): boolean {
  const [transitionDoneKey, setTransitionDoneKey] = useState<string | null>(
    null,
  )
  const showsPrevious =
    hasTransition(shown) && !!shown.previous && transitionDoneKey !== shown.key

  useLayoutEffect(() => {
    const root = currentRef.current
    if (!root) return
    applyParagraphStates(
      root,
      groups,
      deckTargetStates(groups, shown.buildIndex),
    )
    if (shown.entry === 'static') return

    logger.debug(
      `Deck item ${shown.itemId}: slide ${shown.slideIndex + 1}, build ${shown.buildIndex} (${shown.entry})`,
    )
    const running: Animation[] = []
    let offsetMs = 0
    const transition = shown.slide.transition
    const frames =
      transition && hasTransition(shown)
        ? transitionKeyframes(transition)
        : null
    if (transition && frames) {
      const timing = { duration: transition.durationMs, easing: 'ease-in-out' }
      running.push(root.animate(frames.incoming, timing))
      const previous = previousRef.current
      if (frames.outgoing && previous) {
        running.push(previous.animate(frames.outgoing, timing))
      }
      offsetMs = transition.durationMs
    }
    running.push(
      ...playClickGroup({
        root,
        slide: shown.slide,
        groups,
        buildIndex: shown.buildIndex,
        width: shown.width,
        height: shown.height,
        offsetMs,
      }),
    )
    return () => {
      for (const animation of running) animation.cancel()
    }
  }, [shown, groups, currentRef, previousRef])

  // The slide before it goes once the transition has played.
  useEffect(() => {
    if (!hasTransition(shown)) return
    const timer = setTimeout(
      () => setTransitionDoneKey(shown.key),
      shown.slide.transition?.durationMs ?? 0,
    )
    return () => clearTimeout(timer)
  }, [shown])

  return showsPrevious
}
