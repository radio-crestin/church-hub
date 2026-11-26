import { textSources } from './textSources'
import type { DeckElementBase, DeckTextElement } from '../../types'
import type { PptxShapeContext } from '../slide/types'
import { levelStyle } from '../text/levelStyle'
import { readBodyStyle } from '../text/readBodyStyle'
import { textBodyHtml } from '../text/textBodyHtml'
import type { PptxRgba } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'

/** Office's default left and right text inset: 0.1 inch. */
const DEFAULT_INSET = 91_440

/**
 * A shape's text as a deck text box at `base`'s place, with its look through
 * the master, layout and shape, its anchoring, inset and autofit; null when
 * it holds no text.
 */
export function readTextElement(
  shape: Element,
  inherited: { layout: Element | null; master: Element | null },
  base: Omit<DeckElementBase, 'id'> & { id: string },
  context: PptxShapeContext,
  fontColor?: PptxRgba,
): DeckTextElement | null {
  const txBody = xmlChild(shape, 'txBody')
  if (!txBody) return null
  const { styles, bodies } = textSources(shape, inherited, context)
  const body = readBodyStyle(bodies)
  const color = context.parts.color
  const pointPx = 12_700 * context.deck.scale
  const text = textBodyHtml(txBody, {
    levelStyle: (level) => levelStyle(styles, level, color),
    fontColor,
    body,
    color,
    pointPx,
  })
  if (!text) return null
  const inset =
    ((body.insetLeft ?? DEFAULT_INSET) + (body.insetRight ?? DEFAULT_INSET)) / 2
  const scale = body.fontScale ?? 1
  return {
    ...base,
    type: 'text',
    html: text.html,
    verticalAlign: body.anchor ?? 'top',
    fontFamily: text.fontFamily,
    fontSize: text.fontSize,
    color: text.color,
    autofitScale: scale < 1 ? Math.max(0.01, scale) : undefined,
    padding: Math.round(inset * context.deck.scale * 100) / 100,
  }
}
