import { escapeHtml } from './escapeHtml'
import { newDeckId } from './newDeckId'
import { paragraphHtml } from './paragraphHtml'
import type {
  DeckSlide,
  DeckSlideKind,
  DeckTextElement,
  DeckTextStyle,
} from '../types'

/** The words a new slide's boxes wait with, in the app's language. */
export interface DeckPlaceholders {
  title: string
  text: string
}

/** Laid out on 1920×1080, then scaled to the deck. */
const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080

/** A text box in the theme's style, on the 1920×1080 grid. */
function textBox(
  box: { x: number; y: number; w: number; h: number },
  html: string,
  style: DeckTextStyle,
  fontSize: number,
  verticalAlign: DeckTextElement['verticalAlign'],
): DeckTextElement {
  return {
    id: newDeckId(),
    type: 'text',
    ...box,
    html,
    verticalAlign,
    fontFamily: style.fontFamily,
    fontSize,
    color: style.color,
  }
}

/** The layouts of PowerPoint's slide kinds, on the 1920×1080 grid. */
function elementsFor(
  kind: DeckSlideKind,
  style: DeckTextStyle,
  placeholders: DeckPlaceholders,
): DeckTextElement[] {
  const title = paragraphHtml(placeholders.title, style.alignment, style)
  const topTitle = () =>
    textBox(
      { x: 120, y: 60, w: 1680, h: 200 },
      title,
      style,
      Math.round(style.fontSize * 0.8),
      'middle',
    )
  switch (kind) {
    case 'blank':
      return []
    case 'title':
      return [
        textBox(
          { x: 160, y: 390, w: 1600, h: 300 },
          title,
          style,
          style.fontSize,
          'middle',
        ),
      ]
    case 'title_text':
      return [
        topTitle(),
        textBox(
          { x: 120, y: 300, w: 1680, h: 700 },
          `<ul><li><p>${escapeHtml(placeholders.text)}</p></li></ul>`,
          style,
          Math.round(style.fontSize * 0.55),
          'top',
        ),
      ]
    case 'picture':
    case 'video':
      return [topTitle()]
  }
}

/**
 * A new slide of `kind` for a deck of `width`×`height`: its boxes laid out as
 * PowerPoint's (a title, a title and a bulleted text, a title over room for
 * a picture or video), in the presentation's theme `style`, waiting with
 * `placeholders`.
 */
export function newSlide(
  kind: DeckSlideKind,
  style: DeckTextStyle,
  placeholders: DeckPlaceholders,
  width = BASE_WIDTH,
  height = BASE_HEIGHT,
): DeckSlide {
  const sx = width / BASE_WIDTH
  const sy = height / BASE_HEIGHT
  return {
    id: newDeckId(),
    kind,
    background: { type: 'color', color: style.background },
    elements: elementsFor(kind, style, placeholders).map((e) => ({
      ...e,
      x: Math.round(e.x * sx),
      y: Math.round(e.y * sy),
      w: Math.round(e.w * sx),
      h: Math.round(e.h * sy),
      fontSize: e.fontSize && Math.round(e.fontSize * Math.min(sx, sy)),
    })),
  }
}
