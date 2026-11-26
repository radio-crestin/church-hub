import { useCallback, useEffect, useMemo, useState } from 'react'

import type { DeckShownSlide, DeckSlide, SlideDeck } from '../../types'
import { clickGroupMs } from '../../utils/clickGroupMs'
import { slideTimeline } from '../../utils/slideTimeline'

/** A pause after each click's effects, as an operator would leave. */
const PAUSE_MS = 500

/** The slide as Preview plays it at `buildIndex`. */
function previewStep(
  deck: SlideDeck,
  slide: DeckSlide,
  buildIndex: number,
): DeckShownSlide {
  return {
    key: `preview|${slide.id}|${buildIndex}`,
    itemId: 0,
    width: deck.width,
    height: deck.height,
    slide,
    slideIndex: 0,
    buildIndex,
    entry: buildIndex === 0 ? 'enter' : 'build',
    previous: null,
  }
}

/**
 * Preview: plays the slide in the canvas as Down would on the screens, its
 * transition and every click in turn, then goes back to editing.
 */
export function useDeckPreview(deck: SlideDeck, slide: DeckSlide | undefined) {
  const [buildIndex, setBuildIndex] = useState<number | null>(null)
  const groups = useMemo(() => (slide ? slideTimeline(slide) : []), [slide])

  useEffect(() => {
    if (buildIndex === null || !slide) return
    const group = groups[buildIndex]
    const transitionMs =
      buildIndex === 0 && slide.transition?.effect !== 'none'
        ? (slide.transition?.durationMs ?? 0)
        : 0
    const timer = setTimeout(
      () =>
        setBuildIndex(buildIndex + 1 < groups.length ? buildIndex + 1 : null),
      transitionMs + (group ? clickGroupMs(group) : 0) + PAUSE_MS,
    )
    return () => clearTimeout(timer)
  }, [buildIndex, groups, slide])

  const start = useCallback(() => setBuildIndex(0), [])
  const stop = useCallback(() => setBuildIndex(null), [])
  // One object per step: the renderer plays each step once.
  const shown = useMemo(
    () =>
      buildIndex !== null && slide
        ? previewStep(deck, slide, buildIndex)
        : null,
    [buildIndex, deck, slide],
  )
  return { shown, start, stop }
}
