/**
 * Parse text input into structured schedule items
 */

export type ParsedItemType =
  | 'song'
  | 'announcement'
  | 'bible_passage'
  | 'versete_tineri'
  | 'scene'

export interface ParsedScheduleItem {
  type: ParsedItemType
  content: string
  lineNumber: number
}

export interface ParseScheduleTextResult {
  items: ParsedScheduleItem[]
  errors: Array<{ line: number; message: string }>
}

// Matches: Content [PREFIX] format (case-insensitive)
// Supports: [S], [C], [SC], [A], [V], [VT]
// [C] is Romanian alias for [S] (Cantec = Song)
const SUFFIX_REGEX = /^(.+?)\s*\[(SC|S|C|A|VT|V)\]\s*$/i

const TYPE_MAP: Record<string, ParsedItemType> = {
  SC: 'scene',
  S: 'song',
  C: 'song', // Romanian: Cantec
  A: 'announcement',
  V: 'bible_passage',
  VT: 'versete_tineri',
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

    const match = trimmed.match(SUFFIX_REGEX)
    if (!match) {
      errors.push({
        line: lineNumber,
        message: 'Invalid format. Use [S], [C], [SC], [A], [V], or [VT] suffix',
      })
      return
    }

    const [, content, suffix] = match
    const type = TYPE_MAP[suffix.toUpperCase()]

    if (!type) {
      errors.push({
        line: lineNumber,
        message: 'Unknown suffix',
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
