import { type PptxFill, readFillElement } from './readFillElement'
import { resolveColor } from '../theme/resolveColor'
import type { PptxColorContext, PptxRgba } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

/** What a shape's `p:style` gives it when its own properties set nothing. */
export interface PptxStyleRefs {
  fill?: PptxFill
  line?: { color: PptxRgba; widthEmu: number }
  /** Its text's colour (`fontRef`). */
  fontColor?: PptxRgba
}

/**
 * A shape's theme style (`p:style`): `fillRef` picks a theme fill painted in
 * its colour, `lnRef` a theme line width in its colour, `fontRef` the text
 * colour.
 */
export function readStyleRef(
  shape: Element,
  color: PptxColorContext,
): PptxStyleRefs {
  const style = xmlChild(shape, 'style')
  if (!style) return {}
  const refs: PptxStyleRefs = {}
  const fillRef = xmlChild(style, 'fillRef')
  const fillIdx = xmlNumber(fillRef, 'idx') ?? 0
  const fillColor = resolveColor(fillRef, color)
  if (fillIdx > 0 && fillColor) {
    const entry = color.theme.fills[fillIdx - 1]
    refs.fill = entry
      ? readFillElement(entry, { ...color, placeholderColor: fillColor })
      : { kind: 'color', color: fillColor }
  }
  const lnRef = xmlChild(style, 'lnRef')
  const lnIdx = xmlNumber(lnRef, 'idx') ?? 0
  const lineColor = resolveColor(lnRef, color)
  if (lnIdx > 0 && lineColor) {
    refs.line = {
      color: lineColor,
      widthEmu: color.theme.lineWidths[lnIdx - 1] ?? 12_700,
    }
  }
  const fontColor = resolveColor(xmlChild(style, 'fontRef'), color)
  if (fontColor) refs.fontColor = fontColor
  return refs
}
