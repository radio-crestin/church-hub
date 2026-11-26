import {
  FILL_ELEMENTS,
  type PptxFill,
  readFillElement,
} from './readFillElement'
import type { PptxColorContext } from '../theme/types'
import { xmlChildren } from '../xml/xmlChildren'

/**
 * The fill set in `parent` (a shape's `spPr`, a background's `bgPr`); undefined
 * when it sets none, so the caller can inherit one.
 */
export function readFill(
  parent: Element | null | undefined,
  color: PptxColorContext,
): PptxFill | undefined {
  const fill = xmlChildren(parent).find((child) =>
    FILL_ELEMENTS.has(child.localName),
  )
  return fill ? readFillElement(fill, color) : undefined
}
