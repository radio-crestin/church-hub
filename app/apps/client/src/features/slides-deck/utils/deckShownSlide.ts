import type { TemporaryDeckSlideContent } from '~/features/presentation/types'
import type { DeckShownSlide } from '../types'

/** What a screen showed last: its deck step, if any, and its program step. */
export interface DeckShownBefore {
  deck: DeckShownSlide | null
  step: { scheduleId?: number; scheduleItemIndex?: number } | null
}

/** A later step of the same program: Down, not Up. */
function isBackwards(
  data: TemporaryDeckSlideContent,
  step: DeckShownBefore['step'],
): boolean {
  return (
    data.scheduleId !== undefined &&
    step?.scheduleId === data.scheduleId &&
    (data.scheduleItemIndex ?? 0) < (step.scheduleItemIndex ?? 0)
  )
}

/**
 * A deck step as a screen draws it, and how it comes on (`entry`) after what
 * the screen showed `before` (null: the first thing it sees, played as it
 * stands): the next click group of the same slide is a `build`; a slide's
 * first step reached going forward `enter`s, over the slide before it when
 * that was a deck slide too; anything else (Up, a jump) is `static`. The same
 * step again is the same object, so nothing plays twice (a new one, static,
 * when its slide was edited meanwhile).
 */
export function deckShownSlide(
  data: TemporaryDeckSlideContent,
  before: DeckShownBefore | null,
): DeckShownSlide {
  const key = `${data.scheduleId ?? ''}|${data.itemId}|${data.slideIndex}|${data.buildIndex}`
  const last = before?.deck ?? null
  if (last?.key === key) {
    // The same step, its slide edited meanwhile: drawn anew, nothing played.
    const edited =
      last.width !== data.width ||
      last.height !== data.height ||
      JSON.stringify(last.slide) !== JSON.stringify(data.slide)
    if (!edited) return last
    return {
      ...last,
      width: data.width,
      height: data.height,
      slide: data.slide,
      entry: 'static',
      previous: null,
    }
  }
  const shown: DeckShownSlide = {
    key,
    itemId: data.itemId,
    width: data.width,
    height: data.height,
    slide: data.slide,
    slideIndex: data.slideIndex,
    buildIndex: data.buildIndex,
    entry: 'static',
    previous: null,
  }
  if (!before) return shown
  if (last?.itemId === data.itemId && last.slideIndex === data.slideIndex) {
    return {
      ...shown,
      entry: data.buildIndex === last.buildIndex + 1 ? 'build' : 'static',
    }
  }
  if (data.buildIndex !== 0 || isBackwards(data, before.step)) return shown
  return {
    ...shown,
    entry: 'enter',
    previous: last && {
      width: last.width,
      height: last.height,
      slide: last.slide,
      buildIndex: last.buildIndex,
    },
  }
}
