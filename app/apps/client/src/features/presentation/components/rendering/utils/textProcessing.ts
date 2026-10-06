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
