import { mergeDefined } from './mergeDefined'
import type { PptxBodyStyle } from './types'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

const ANCHOR: Record<string, PptxBodyStyle['anchor']> = {
  t: 'top',
  ctr: 'middle',
  b: 'bottom',
}

/**
 * A text body's frame from its `a:bodyPr`s, the master's placeholder first,
 * then the layout's, then the shape's own, each setting what it sets.
 */
export function readBodyStyle(bodyPrs: (Element | null)[]): PptxBodyStyle {
  let style: PptxBodyStyle = {}
  for (const bodyPr of bodyPrs) {
    if (!bodyPr) continue
    const autofit = xmlChild(bodyPr, 'normAutofit')
    style = mergeDefined(style, {
      anchor: ANCHOR[bodyPr.getAttribute('anchor') ?? ''],
      insetLeft: xmlNumber(bodyPr, 'lIns'),
      insetTop: xmlNumber(bodyPr, 'tIns'),
      insetRight: xmlNumber(bodyPr, 'rIns'),
      insetBottom: xmlNumber(bodyPr, 'bIns'),
      fontScale: autofit
        ? (xmlNumber(autofit, 'fontScale') ?? 100_000) / 100_000
        : xmlChild(bodyPr, 'noAutofit') || xmlChild(bodyPr, 'spAutoFit')
          ? 1
          : undefined,
      lineSpacingReduction: autofit
        ? (xmlNumber(autofit, 'lnSpcReduction') ?? 0) / 100_000
        : undefined,
    })
  }
  return style
}
