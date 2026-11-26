import { mergeDefined } from './mergeDefined'
import type { PptxParagraphStyle } from './types'

/** `base` with what `over` sets put over it, its run defaults merged too. */
export function mergeParagraphStyle(
  base: PptxParagraphStyle,
  over: PptxParagraphStyle,
): PptxParagraphStyle {
  return {
    ...mergeDefined(base, { ...over, run: undefined }),
    run: mergeDefined(base.run, over.run),
  }
}
