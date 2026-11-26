import type { PptxRunStyle } from './types'
import { resolveColor } from '../theme/resolveColor'
import type { PptxColorContext } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

const flag = (element: Element, name: string) => {
  const value = element.getAttribute(name)
  return value == null ? undefined : value === '1' || value === 'true'
}

/** What a run's properties (`a:rPr`, `a:defRPr`, `a:endParaRPr`) set. */
export function readRunStyle(
  rPr: Element | null,
  color: PptxColorContext,
): PptxRunStyle {
  if (!rPr) return {}
  const size = xmlNumber(rPr, 'sz')
  const underline = rPr.getAttribute('u')
  const cap = rPr.getAttribute('cap')
  const fill =
    xmlChild(rPr, 'solidFill') ?? xmlChild(rPr, 'gradFill', 'gsLst', 'gs')
  const typeface = xmlChild(rPr, 'latin')?.getAttribute('typeface')
  const font =
    typeface === '+mj-lt'
      ? color.theme.majorFont
      : typeface?.startsWith('+')
        ? color.theme.minorFont
        : typeface || undefined
  return {
    sizePt: size === undefined ? undefined : size / 100,
    bold: flag(rPr, 'b'),
    italic: flag(rPr, 'i'),
    underline: underline == null ? undefined : underline !== 'none',
    color: (fill && resolveColor(fill, color)) || undefined,
    font,
    caps: cap == null ? undefined : cap === 'all',
  }
}
