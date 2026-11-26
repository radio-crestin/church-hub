import { mergeParagraphStyle } from './mergeParagraphStyle'
import { readParagraphStyle } from './readParagraphStyle'
import type { PptxParagraphStyle } from './types'
import type { PptxColorContext } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'

/**
 * A paragraph level's style (0 = `a:lvl1pPr`) through its sources, the least
 * specific first: the master's text styles, the master's and the layout's
 * placeholder, the shape's own list style.
 */
export function levelStyle(
  sources: (Element | null)[],
  level: number,
  color: PptxColorContext,
): PptxParagraphStyle {
  let style: PptxParagraphStyle = { run: {} }
  for (const source of sources) {
    const pPr = xmlChild(source, `lvl${level + 1}pPr`)
    if (pPr) style = mergeParagraphStyle(style, readParagraphStyle(pPr, color))
  }
  return style
}
