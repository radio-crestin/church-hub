/**
 * Parse text input into structured schedule items
 */

export type ParsedItemType = 'song' | 'announcement' | 'bible_verse'

export interface ParsedScheduleItem {
  type: ParsedItemType
  content: string
  lineNumber: number
}

export interface ParseScheduleTextResult {
  items: ParsedScheduleItem[]
  errors: Array<{ line: number; message: string }>
}

// Matches: S:, A:, V: (case-insensitive) followed by content
const PREFIX_REGEX = /^([SAV]):\s*(.+)$/i

const TYPE_MAP: Record<string, ParsedItemType> = {
  S: 'song',
  A: 'announcement',
  V: 'bible_verse',
}

export function parseScheduleText(text: string): ParseScheduleTextResult {
  const lines = text.split('\n')
  const items: ParsedScheduleItem[] = []
  const errors: Array<{ line: number; message: string }> = []

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }

    const match = trimmed.match(PREFIX_REGEX)
    if (!match) {
      errors.push({
        line: lineNumber,
        message: 'Invalid format. Use S:, A:, or V: prefix',
      })
      return
    }

    const [, prefix, content] = match
    const type = TYPE_MAP[prefix.toUpperCase()]

    if (!type) {
      errors.push({
        line: lineNumber,
        message: 'Unknown prefix',
      })
      return
    }

    const trimmedContent = content.trim()
    if (!trimmedContent) {
      errors.push({
        line: lineNumber,
        message: 'Content cannot be empty',
      })
      return
    }

    items.push({
      type,
      content: trimmedContent,
      lineNumber,
    })
  })

  return { items, errors }
}
