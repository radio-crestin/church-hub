import type { DeckSlide } from '../types'

/** The words a slide shows, without markup: its text boxes' and shapes'. */
export function deckSlideText(slide: DeckSlide): string {
  return slide.elements
    .map((e) => (e.type === 'text' || e.type === 'shape' ? (e.html ?? '') : ''))
    .join(' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
