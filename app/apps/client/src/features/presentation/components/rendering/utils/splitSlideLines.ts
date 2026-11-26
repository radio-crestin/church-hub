import type { TextStyleRange } from '../../../types'
import { applyStylesToText } from '../../../utils/applyStylesToText'
import { offsetStyleRanges } from '../../../utils/offsetStyleRanges'

export interface SlideLine {
  /** The line's text, as slides are compared */
  text: string
  /** What the line shows: its text plus the line break after it, if any */
  shown: string
  /** The shown text with the slide's styled runs, or null when it has none */
  html: string | null
}

/**
 * Cuts a slide's text into its lines, each keeping its line break so the
 * lines together hold exactly the slide's text (selections count characters
 * across them) and lay out exactly like the text as one block. Style ranges,
 * counted over the whole text, are moved onto each line.
 */
export function splitSlideLines(
  text: string,
  ranges: TextStyleRange[] | undefined,
): SlideLine[] {
  const lines = text.split('\n')
  let start = 0
  return lines.map((line, index) => {
    const shown = index < lines.length - 1 ? `${line}\n` : line
    const lineRanges = offsetStyleRanges(ranges, -start)
    const html = lineRanges?.length
      ? applyStylesToText(shown, lineRanges)
      : null
    start += shown.length
    return { text: line, shown, html }
  })
}
