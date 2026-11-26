import { placeholderOf } from './placeholderOf'
import type { PptxShapeContext } from '../slide/types'
import { xmlChild } from '../xml/xmlChild'

const TITLES = new Set(['title', 'ctrTitle'])
const OTHERS = new Set(['dt', 'ftr', 'sldNum'])

/**
 * Where a shape's text takes its look from, the least specific first: the
 * master's title, body or other text style for a placeholder (the file's
 * default text style for any other shape), then the master's and layout's
 * placeholder and the shape's own list style; and its frames (`a:bodyPr`)
 * the same way.
 */
export function textSources(
  shape: Element,
  inherited: { layout: Element | null; master: Element | null },
  context: PptxShapeContext,
): { styles: (Element | null)[]; bodies: (Element | null)[] } {
  const ph = placeholderOf(shape)
  const txStyles = xmlChild(
    context.parts.master?.doc.documentElement,
    'txStyles',
  )
  const type = ph?.getAttribute('type') || 'body'
  const base = !ph
    ? context.deck.defaultTextStyle
    : xmlChild(
        txStyles,
        TITLES.has(type)
          ? 'titleStyle'
          : OTHERS.has(type)
            ? 'otherStyle'
            : 'bodyStyle',
      )
  const lstStyle = (from: Element | null) =>
    xmlChild(from, 'txBody', 'lstStyle')
  const bodyPr = (from: Element | null) => xmlChild(from, 'txBody', 'bodyPr')
  return {
    styles: [
      base,
      lstStyle(inherited.master),
      lstStyle(inherited.layout),
      lstStyle(shape),
    ],
    bodies: [bodyPr(inherited.master), bodyPr(inherited.layout), bodyPr(shape)],
  }
}
