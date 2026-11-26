import { clickGroupMs } from './clickGroupMs'
import { slideTimeline } from './slideTimeline'
import type { DeckStep, SlideDeck } from '../types'

/**
 * How long a deck step takes to play: its slide's transition (its first
 * step), then its click group's effects.
 */
export function deckStepMs(deck: SlideDeck, step: DeckStep): number {
  const slide = deck.slides[step.slideIndex]
  if (!slide) return 0
  const group = slideTimeline(slide)[step.buildIndex] ?? []
  const transitionMs =
    step.buildIndex === 0 ? (slide.transition?.durationMs ?? 0) : 0
  return transitionMs + clickGroupMs(group)
}
