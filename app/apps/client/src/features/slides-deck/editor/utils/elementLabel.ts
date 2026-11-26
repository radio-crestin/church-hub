import type { TFunction } from 'i18next'

import type { DeckElement } from '../../types'

/** How the editor names an element: its first words, else its kind. */
export function elementLabel(element: DeckElement, t: TFunction): string {
  const html =
    element.type === 'text' || element.type === 'shape' ? element.html : ''
  const words = (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return words || t(`deckEditor.elementTypes.${element.type}`)
}
