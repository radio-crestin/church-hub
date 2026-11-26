import { deckSlideText } from './deckSlideText'
import type { SlideDeck } from '../types'

/** The first words a deck shows, to name it in lists; '' when it has none. */
export function deckFirstText(deck: SlideDeck | null | undefined): string {
  for (const slide of deck?.slides ?? []) {
    const text = deckSlideText(slide)
    if (text) return text
  }
  return ''
}
