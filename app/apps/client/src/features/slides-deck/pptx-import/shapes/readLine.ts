import { resolveColor } from '../theme/resolveColor'
import type { PptxColorContext, PptxRgba } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

/**
 * A shape's own outline (`a:ln` in its `spPr`): null for none, undefined when
 * it sets none (the theme style's line then applies).
 */
export function readLine(
  spPr: Element | null,
  color: PptxColorContext,
): { color: PptxRgba; widthEmu: number } | null | undefined {
  const ln = xmlChild(spPr, 'ln')
  if (!ln) return undefined
  if (xmlChild(ln, 'noFill')) return null
  const fill =
    xmlChild(ln, 'solidFill') ?? xmlChild(ln, 'gradFill', 'gsLst', 'gs')
  const c = fill ? resolveColor(fill, color) : null
  if (!c) return undefined
  return { color: c, widthEmu: xmlNumber(ln, 'w') ?? 9525 }
}
