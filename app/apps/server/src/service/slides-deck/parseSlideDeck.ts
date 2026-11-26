import { deckReader } from './deckReader'
import { parseDeckSlide } from './parseDeckSlide'
import type { SlideDeck } from './types'

const DEFAULT_WIDTH = 1920
const DEFAULT_HEIGHT = 1080

/**
 * A Slides item's deck as the API receives it, checked and rebuilt field by
 * field (ids, numbers, kinds, colours, gallery media ids) with its text boxes'
 * HTML sanitized; throws on anything that does not fit, so a bad deck is
 * refused instead of stored. The design size defaults to 1920×1080.
 */
export function parseSlideDeck(value: unknown): SlideDeck {
  const r = deckReader(value, 'deck')
  const slides = r
    .array('slides', 1000)
    .map((s, i) => parseDeckSlide(s, `slides[${i}]`))
  const ids = new Set(slides.map((s) => s.id))
  if (ids.size !== slides.length) r.fail('slides', 'have the same id twice')
  const source = r.value('source')
  return {
    width: r.optionalNumber('width', 16, 16_384) ?? DEFAULT_WIDTH,
    height: r.optionalNumber('height', 16, 16_384) ?? DEFAULT_HEIGHT,
    slides,
    source:
      source === undefined
        ? undefined
        : (() => {
            const s = deckReader(source, 'deck.source')
            return {
              kind: s.oneOf('kind', ['pptx'] as const),
              fileName: s.string('fileName', 500),
            }
          })(),
  }
}
