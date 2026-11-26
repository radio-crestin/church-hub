import { resolveColor } from '../theme/resolveColor'
import type { PptxColorContext, PptxRgba } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlChildren } from '../xml/xmlChildren'

/** A fill as the deck can draw it. */
export type PptxFill =
  | { kind: 'none' }
  | { kind: 'color'; color: PptxRgba }
  /** A gradient, drawn in its first stop's colour. */
  | { kind: 'gradient'; color: PptxRgba }
  | { kind: 'picture'; blipFill: Element }

export const FILL_ELEMENTS = new Set([
  'noFill',
  'solidFill',
  'gradFill',
  'blipFill',
  'pattFill',
  'grpFill',
])

/** One fill element (`a:solidFill`, `a:gradFill`, …) as the deck can draw it. */
export function readFillElement(
  fill: Element,
  color: PptxColorContext,
): PptxFill {
  switch (fill.localName) {
    case 'solidFill': {
      const c = resolveColor(fill, color)
      return c ? { kind: 'color', color: c } : { kind: 'none' }
    }
    case 'gradFill': {
      const stop = xmlChildren(xmlChild(fill, 'gsLst'), 'gs')[0]
      const c = resolveColor(stop, color)
      return c ? { kind: 'gradient', color: c } : { kind: 'none' }
    }
    case 'pattFill': {
      const c = resolveColor(xmlChild(fill, 'fgClr'), color)
      return c ? { kind: 'color', color: c } : { kind: 'none' }
    }
    case 'blipFill':
      return { kind: 'picture', blipFill: fill }
    default:
      return { kind: 'none' }
  }
}
