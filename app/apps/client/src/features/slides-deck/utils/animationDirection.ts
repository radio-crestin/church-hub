import type { DeckAnimationEffect, DeckDirection } from '../types'

/**
 * The side each effect that comes from one starts from when none is set:
 * PowerPoint's defaults (Fly In and Wipe from the bottom, Split vertical).
 */
export const ANIMATION_DEFAULT_DIRECTIONS: Partial<
  Record<DeckAnimationEffect, DeckDirection>
> = { fly: 'down', wipe: 'down', split: 'left' }

/**
 * The side an effect comes from as it plays: its own, else its default;
 * undefined for an effect that comes from no side. The editor shows and the
 * renderer plays this same value.
 */
export function animationDirection(
  effect: DeckAnimationEffect,
  direction: DeckDirection | undefined,
): DeckDirection | undefined {
  const fallback = ANIMATION_DEFAULT_DIRECTIONS[effect]
  return fallback ? (direction ?? fallback) : undefined
}
