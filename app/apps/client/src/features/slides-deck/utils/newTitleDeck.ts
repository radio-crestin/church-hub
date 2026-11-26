import { type DeckPlaceholders, newSlide } from './newSlide'
import type { DeckTextStyle, SlideDeck } from '../types'

/**
 * A new deck: one title slide in the presentation's theme `style`, its title
 * box waiting for its text.
 */
export function newTitleDeck(
  style: DeckTextStyle,
  placeholders: DeckPlaceholders,
): SlideDeck {
  return {
    width: 1920,
    height: 1080,
    slides: [newSlide('title', style, placeholders)],
  }
}
