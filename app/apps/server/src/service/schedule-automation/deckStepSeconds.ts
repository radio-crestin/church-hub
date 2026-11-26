import type { ScheduleStep } from './buildScheduleSteps'
import { deckStepMs } from '../slides-deck/deckStepMs'
import { deckSteps } from '../slides-deck/deckSteps'
import type { SlideDeck } from '../slides-deck/types'

/**
 * How long a Slides item's step stays up while the presentation runs by
 * itself: its slide's "advance after" time, else `fallbackSeconds`, and never
 * less than its transition and effects take to play. Mirrored by the
 * client's `deckStepSeconds`.
 */
export function deckStepSeconds(
  step: ScheduleStep,
  fallbackSeconds: number,
): number {
  const deck = step.item.itemConfig as SlideDeck
  const at = deckSteps(deck)[step.index]
  if (!at) return fallbackSeconds
  const advanceAfterMs = deck.slides[at.slideIndex]?.advanceAfterMs
  const seconds =
    advanceAfterMs != null ? advanceAfterMs / 1000 : fallbackSeconds
  return Math.ceil(Math.max(seconds, deckStepMs(deck, at) / 1000))
}
