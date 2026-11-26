import type { DeckDirection, DeckTransitionEffect } from '../types'

/** The transitions that come from a side, from the bottom when none is set. */
export const TRANSITION_DEFAULT_DIRECTIONS: Partial<
  Record<DeckTransitionEffect, DeckDirection>
> = { push: 'down', wipe: 'down', cover: 'down', split: 'down' }

/**
 * The side a transition comes from as it plays: its own, else its default;
 * undefined for one that comes from no side. The editor shows and the
 * renderer plays this same value.
 */
export function transitionDirection(
  effect: DeckTransitionEffect,
  direction: DeckDirection | undefined,
): DeckDirection | undefined {
  const fallback = TRANSITION_DEFAULT_DIRECTIONS[effect]
  return fallback ? (direction ?? fallback) : undefined
}
