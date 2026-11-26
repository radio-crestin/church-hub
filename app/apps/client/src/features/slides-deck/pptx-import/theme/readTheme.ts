import type { PptxTheme } from './types'
import { xmlChild } from '../xml/xmlChild'
import { xmlChildren } from '../xml/xmlChildren'
import { xmlNumber } from '../xml/xmlNumber'

/** Office's own scheme, for a file without a theme. */
const OFFICE_COLORS: Record<string, string> = {
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '44546A',
  lt2: 'E7E6E6',
  accent1: '4472C4',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '5B9BD5',
  accent6: '70AD47',
  hlink: '0563C1',
  folHlink: '954F72',
}

/** A theme part's colours, fonts and style matrix (`a:theme`). */
export function readTheme(doc: Document | null): PptxTheme {
  const elements = xmlChild(doc?.documentElement, 'themeElements')
  const colors = { ...OFFICE_COLORS }
  for (const color of xmlChildren(xmlChild(elements, 'clrScheme'))) {
    const value = xmlChild(color, 'srgbClr')?.getAttribute('val')
    const system = xmlChild(color, 'sysClr')?.getAttribute('lastClr')
    if (value ?? system) colors[color.localName] = (value ?? system) as string
  }
  const fonts = xmlChild(elements, 'fontScheme')
  const matrix = xmlChild(elements, 'fmtScheme')
  return {
    colors,
    majorFont:
      xmlChild(fonts, 'majorFont', 'latin')?.getAttribute('typeface') ||
      'Calibri Light',
    minorFont:
      xmlChild(fonts, 'minorFont', 'latin')?.getAttribute('typeface') ||
      'Calibri',
    backgroundFills: xmlChildren(xmlChild(matrix, 'bgFillStyleLst')),
    fills: xmlChildren(xmlChild(matrix, 'fillStyleLst')),
    lineWidths: xmlChildren(xmlChild(matrix, 'lnStyleLst'), 'ln').map(
      (line) => xmlNumber(line, 'w') ?? 9525,
    ),
  }
}
