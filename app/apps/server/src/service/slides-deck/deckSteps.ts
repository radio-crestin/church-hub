import { slideTimeline } from './slideTimeline'
import type { DeckStep, SlideDeck } from './types'

/**
 * A deck's steps in order, like PowerPoint's clicks: each slide once with its
 * group 0 played, then once more per click group. Mirrored by the client's
 * `deckSteps`, so both count a presentation's steps the same.
 */
export function deckSteps(deck: SlideDeck): DeckStep[] {
  return deck.slides.flatMap((slide, slideIndex) =>
    slideTimeline(slide).map((_, buildIndex) => ({ slideIndex, buildIndex })),
  )
}
