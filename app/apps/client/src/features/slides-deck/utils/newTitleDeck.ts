import { newDeckId } from './newDeckId'
import type { SlideDeck } from '../types'

const WIDTH = 1920
const HEIGHT = 1080

/** `text` safe inside HTML. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * A new deck: one title slide, its title box centred and waiting for its
 * text (`placeholder`, in the app's language).
 */
export function newTitleDeck(placeholder: string): SlideDeck {
  return {
    width: WIDTH,
    height: HEIGHT,
    slides: [
      {
        id: newDeckId(),
        kind: 'title',
        background: { type: 'color', color: '#000000' },
        elements: [
          {
            id: newDeckId(),
            type: 'text',
            x: 160,
            y: 390,
            w: 1600,
            h: 300,
            html: `<p style="text-align: center">${escapeHtml(placeholder)}</p>`,
            verticalAlign: 'middle',
            fontSize: 88,
            color: '#ffffff',
          },
        ],
      },
    ],
  }
}
