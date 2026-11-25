import { deckReader } from './deckReader'
import { parseDeckAnimation } from './parseDeckAnimation'
import { sanitizeDeckHtml } from './sanitizeDeckHtml'
import {
  DECK_FALLBACK_REASONS,
  DECK_IMAGE_FITS,
  DECK_SHAPES,
  DECK_VERTICAL_ALIGNS,
  type DeckElement,
  type DeckElementBase,
} from './types'

const HTML_MAX = 100_000

/** A crop's fractions cut from each side. */
function parseCrop(value: unknown, path: string) {
  const r = deckReader(value, path)
  return {
    l: r.number('l', 0, 1),
    t: r.number('t', 0, 1),
    r: r.number('r', 0, 1),
    b: r.number('b', 0, 1),
  }
}

/**
 * One element of a slide, checked field by field and rebuilt from the fields
 * it may have, its HTML sanitized (sanitizeDeckHtml).
 */
export function parseDeckElement(value: unknown, path: string): DeckElement {
  const r = deckReader(value, path)
  const base: DeckElementBase = {
    id: r.id(),
    x: r.number('x'),
    y: r.number('y'),
    w: r.number('w', 0),
    h: r.number('h', 0),
    rotation: r.optionalNumber('rotation', -3600, 3600),
    opacity: r.optionalNumber('opacity', 0, 1),
    locked: r.optionalBoolean('locked'),
    animations:
      r.value('animations') === undefined
        ? undefined
        : r
            .array('animations', 50)
            .map((a, i) => parseDeckAnimation(a, `${path}.animations[${i}]`)),
  }
  const type = r.value('type')
  switch (type) {
    case 'text':
      return {
        ...base,
        type,
        html: sanitizeDeckHtml(r.string('html', HTML_MAX)),
        verticalAlign: r.optionalOneOf('verticalAlign', DECK_VERTICAL_ALIGNS),
        fontFamily: r.optionalFontFamily('fontFamily'),
        fontSize: r.optionalNumber('fontSize', 1, 2000),
        color: r.optionalColor('color'),
        autofitScale: r.optionalNumber('autofitScale', 0.01, 1),
        padding: r.optionalNumber('padding', 0, 1000),
      }
    case 'image':
      return {
        ...base,
        type,
        mediaId: r.mediaId(),
        fit: r.optionalOneOf('fit', DECK_IMAGE_FITS),
        crop:
          r.value('crop') === undefined
            ? undefined
            : parseCrop(r.value('crop'), `${path}.crop`),
      }
    case 'video':
      return {
        ...base,
        type,
        mediaId: r.mediaId(),
        posterMediaId:
          r.value('posterMediaId') === undefined
            ? undefined
            : r.mediaId('posterMediaId'),
        autoplay: r.optionalBoolean('autoplay'),
        loop: r.optionalBoolean('loop'),
        muted: r.optionalBoolean('muted'),
        volume: r.optionalNumber('volume', 0, 1),
      }
    case 'shape':
      return {
        ...base,
        type,
        shape: r.oneOf('shape', DECK_SHAPES),
        fill: r.optionalColor('fill'),
        stroke: r.optionalColor('stroke'),
        strokeWidth: r.optionalNumber('strokeWidth', 0, 1000),
        html:
          r.value('html') === undefined
            ? undefined
            : sanitizeDeckHtml(r.string('html', HTML_MAX)),
      }
    case 'picture_fallback':
      return {
        ...base,
        type,
        mediaId: r.mediaId(),
        reason: r.oneOf('reason', DECK_FALLBACK_REASONS),
      }
    default:
      return r.fail(
        'type',
        'must be one of text, image, video, shape, picture_fallback',
      )
  }
}
