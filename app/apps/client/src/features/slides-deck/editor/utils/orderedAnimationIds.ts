import type { DeckSlide } from '../../types'
import { slideTimeline } from '../../utils/slideTimeline'

/** A slide's animation ids in play order. */
export function orderedAnimationIds(slide: DeckSlide): string[] {
  return slideTimeline(slide)
    .flat()
    .map((entry) => entry.animation.id)
}
