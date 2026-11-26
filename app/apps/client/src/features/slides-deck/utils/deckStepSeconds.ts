import { deckStepMs } from './deckStepMs'
import { deckSteps } from './deckSteps'
import type { SlideDeck } from '../types'

/**
 * How long a deck's step `index` stays up while the presentation runs by
 * itself: its slide's "advance after" time, else `fallbackSeconds`, and never
 * less than its transition and effects take to play. Mirrors the server's
 * `deckStepSeconds`.
 */
export function deckStepSeconds(
  deck: SlideDeck,
  index: number,
  fallbackSeconds: number,
): number {
  const at = deckSteps(deck)[index]
  if (!at) return fallbackSeconds
  const advanceAfterMs = deck.slides[at.slideIndex]?.advanceAfterMs
  const seconds =
    advanceAfterMs != null ? advanceAfterMs / 1000 : fallbackSeconds
  return Math.ceil(Math.max(seconds, deckStepMs(deck, at) / 1000))
}
