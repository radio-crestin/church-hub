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
  songId?: number
  /**
   * The song's gama as written between braces: `Title #12 {Re major} [S]`.
   * Absent when the line has no braces; '' when they are empty.
   */
  keyLine?: string
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

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1
    const trimmed = lines[index].trim()

    // Stop parsing at separator — everything after is reference-only
    if (trimmed === '---' || trimmed === '--- Schedule Content ---') {
      break
    }

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(SUFFIX_REGEX)
    if (!match) {
      errors.push({
        line: lineNumber,
        message: 'Invalid format. Use [S], [C], [SC], [A], [V], or [VT] suffix',
      })
      continue
    }

    const [, content, suffix] = match
    const type = TYPE_MAP[suffix.toUpperCase()]

    if (!type) {
      errors.push({
        line: lineNumber,
        message: 'Unknown suffix',
      })
      continue
    }

    const trimmedContent = content.trim()
    if (!trimmedContent) {
      errors.push({
        line: lineNumber,
        message: 'Content cannot be empty',
      })
      continue
    }

    if (type !== 'song') {
      items.push({ type, content: trimmedContent, lineNumber })
      continue
    }

    const song = parseSongContent(trimmedContent)
    if (!song.title) {
      errors.push({ line: lineNumber, message: 'Content cannot be empty' })
      continue
    }
    items.push({
      type,
      content: song.title,
      lineNumber,
      ...(song.songId !== undefined && { songId: song.songId }),
      ...(song.keyLine !== undefined && { keyLine: song.keyLine }),
    })
  }

  return { items, errors }
}

// "Song Title", "Song Title #123", "Song Title #123 {Re major}", "Song Title {}"
const SONG_CONTENT_REGEX = /^(.*?)(?:\s+#(\d+))?(?:\s*\{([^{}]*)\})?$/

function parseSongContent(content: string): {
  title: string
  songId?: number
  keyLine?: string
} {
  const [, title = '', id, keyLine] = content.match(SONG_CONTENT_REGEX) ?? []
  return {
    title: title.trim(),
    ...(id !== undefined && { songId: Number.parseInt(id, 10) }),
    ...(keyLine !== undefined && { keyLine: keyLine.trim() }),
  }
}
