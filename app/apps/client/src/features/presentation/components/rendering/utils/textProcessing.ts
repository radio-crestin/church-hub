import type { LineSeparatorType } from '../../../types'

/**
 * Map separator type to actual separator string
 */
const SEPARATOR_MAP: Record<LineSeparatorType, string> = {
  space: '  ',
  dash: ' — ',
  pipe: ' | ',
}

/**
 * Get the separator string for a given separator type
 */
export function getSeparatorString(separator: LineSeparatorType): string {
  return SEPARATOR_MAP[separator] ?? SEPARATOR_MAP.space
}

/**
 * Simple line compression - always combines pairs of lines.
 * Font scaling will handle fitting the combined text.
 *
 * Example with 4 lines:
 * Input:  "Line 1\nLine 2\nLine 3\nLine 4"
 * Output: "Line 1 — Line 2\nLine 3 — Line 4"
 */
export function compressLines(
  text: string,
  separator: LineSeparatorType,
): string {
  const lines = text.split('\n').filter((line) => line.trim() !== '')

  // Don't compress if 2 or fewer lines - keep them as separate lines
  if (lines.length <= 2) {
    return lines.map((line) => line.trim()).join('\n')
  }

  const separatorStr = getSeparatorString(separator)
  const resultLines: string[] = []

  for (let i = 0; i < lines.length; i += 2) {
    const firstLine = lines[i].trim()
    const secondLine = lines[i + 1]?.trim()

    if (secondLine) {
      resultLines.push(`${firstLine}${separatorStr}${secondLine}`)
    } else {
      resultLines.push(firstLine)
    }
  }

  return resultLines.join('\n')
}

/**
 * Compress lines only if combined text fits within threshold of container width.
 * Uses a measurement function to check actual rendered width.
 *
 * Example with 4 lines where all pairs fit:
 * Input:  ["Line 1", "Line 2", "Line 3", "Line 4"]
 * Output: "Line 1 — Line 2\nLine 3 — Line 4"
 *
 * Example where first pair fits but second doesn't:
 * Input:  ["Short", "Text", "Very long line here", "Another long line"]
 * Output: "Short — Text\nVery long line here\nAnother long line"
 *
 * @param text - The text to compress (with newline-separated lines)
 * @param separator - The separator type to use between combined lines
 * @param measureWidth - Function that measures text width in pixels
 * @param maxWidth - Container width in pixels
 * @param fitThreshold - Fraction of maxWidth that combined text must fit (default 0.7 = 70%)
 * @returns Compressed text with combined lines where they fit
 */
export function compressTextLinesWithFit(
  text: string,
  separator: LineSeparatorType,
  measureWidth: (text: string) => number,
  maxWidth: number,
  fitThreshold: number = 0.7,
): string {
  const lines = text.split('\n').filter((line) => line.trim() !== '')

  // Don't compress if 2 or fewer lines - keep them as separate lines
  if (lines.length <= 2) {
    return lines.map((line) => line.trim()).join('\n')
  }

  const separatorStr = getSeparatorString(separator)
  const thresholdWidth = maxWidth * fitThreshold
  const resultLines: string[] = []

  for (let i = 0; i < lines.length; i += 2) {
    const firstLine = lines[i].trim()
    const secondLine = lines[i + 1]?.trim()

    if (secondLine) {
      const combined = `${firstLine}${separatorStr}${secondLine}`
      const combinedWidth = measureWidth(combined)

      if (combinedWidth <= thresholdWidth) {
        // Fits - use compressed version
        resultLines.push(combined)
      } else {
        // Doesn't fit - keep separate
        resultLines.push(firstLine)
        resultLines.push(secondLine)
      }
    } else {
      resultLines.push(firstLine)
    }
  }

  return resultLines.join('\n')
}
