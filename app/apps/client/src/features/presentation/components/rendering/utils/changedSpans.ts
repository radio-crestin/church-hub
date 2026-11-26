import type { SlideLine } from './splitSlideLines'
import type { TextSpan } from './typedSpans'

/**
 * The words a morphing slide change brought in, as stretches of the new text
 * in reading order: whole new lines, and the new words of kept lines. Spaces
 * and the words it kept are not among them.
 */
export function changedSpans(
  lines: SlideLine[],
  lineMatch: (number | null)[],
  tokenMatch: (number | null)[][],
): TextSpan[] {
  const spans: TextSpan[] = []
  let at = 0
  lines.forEach((line, index) => {
    const lineEnd = at + line.text.length
    if (lineMatch[index] === null) {
      if (lineEnd > at) spans.push([at, lineEnd])
    } else {
      let tokenStart = at
      line.tokens.forEach((token, i) => {
        const tokenEnd = tokenStart + token.text.length
        if (tokenMatch[index][i] === null && token.text.trim() !== '') {
          spans.push([tokenStart, tokenEnd])
        }
        tokenStart = tokenEnd
      })
    }
    at = lineEnd + (line.breaks ? 1 : 0)
  })
  return spans
}
