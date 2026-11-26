import { readRunStyle } from './readRunStyle'
import type { PptxParagraphStyle } from './types'
import type { PptxColorContext } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

const ALIGN: Record<string, PptxParagraphStyle['align']> = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
  dist: 'justify',
}

function spacing(element: Element | null) {
  const percent = xmlNumber(xmlChild(element, 'spcPct'), 'val')
  if (percent !== undefined) return { percent: percent / 100_000 }
  const points = xmlNumber(xmlChild(element, 'spcPts'), 'val')
  return points === undefined ? undefined : { points: points / 100 }
}

/** What a paragraph's properties (`a:pPr`, `a:lvlNpPr`) set, its runs' defaults with them. */
export function readParagraphStyle(
  pPr: Element | null,
  color: PptxColorContext,
): PptxParagraphStyle {
  if (!pPr) return { run: {} }
  const bullet = xmlChild(pPr, 'buNone')
    ? 'none'
    : xmlChild(pPr, 'buAutoNum')
      ? 'number'
      : xmlChild(pPr, 'buChar') || xmlChild(pPr, 'buBlip')
        ? 'char'
        : undefined
  return {
    align: ALIGN[pPr.getAttribute('algn') ?? ''],
    marginLeft: xmlNumber(pPr, 'marL'),
    bullet,
    lineSpacing: spacing(xmlChild(pPr, 'lnSpc')),
    spaceBefore: spacing(xmlChild(pPr, 'spcBef')),
    spaceAfter: spacing(xmlChild(pPr, 'spcAft')),
    run: readRunStyle(xmlChild(pPr, 'defRPr'), color),
  }
}
