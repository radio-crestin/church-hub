/**
 * One line of pasted text recognised as something importable
 */
export type ParsedBookmarkLine =
  | {
      kind: 'verse'
      line: number
      content: string
      reference: string
      translationAbbreviation?: string
      /** The styled verse text written under a `## reference` heading. */
      markdown?: string
      /** Line the styled text starts on, for error reports. */
      markdownLine?: number
    }
  | { kind: 'note'; line: number; content: string }

const HEADING = /^##\s+(.*)$/
const QUOTE_NOTE = /^>\s?(.*)$/
const DASHED_NOTE = /^-{3,}\s*(.*?)\s*-{3,}$/

/**
 * Splits pasted text into verse references and notes. Reads the standard
 * Markdown `exportBookmarksAsMarkdown` writes, and the older plain list:
 *
 *   ## Ioan 3:16 - RCCV          a reference heading; the paragraph under it
 *                                is the verse with its **bold**, <u>underline</u>
 *   Fiindcă ... <mark>lumea</mark> and <mark>highlight</mark>
 *
 *   > Predica de duminica         a note (`--- note ---` too)
 *   Psalmi 23:1-3                 a bare reference, optionally ` - ABBR`
 *
 * Blank lines, other headings (`# title`) and indented lines (the old
 * export's verse text) are skipped. Pure text handling only - nothing here
 * touches the database, so the rules stay easy to test.
 */
export function parseBookmarksText(text: string): ParsedBookmarkLine[] {
  const results: ParsedBookmarkLine[] = []
  const lines = text.split(/\r?\n/)
  /** The heading still waiting for its verse text, if any. */
  let heading: Extract<ParsedBookmarkLine, { kind: 'verse' }> | null = null
  let paragraph: string[] = []

  const closeParagraph = () => {
    if (heading && paragraph.length > 0) {
      heading.markdown = paragraph.join('\n')
      heading = null
    }
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNumber = i + 1
    const trimmed = raw.trim()

    if (!trimmed) {
      closeParagraph()
      continue
    }

    const headingMatch = trimmed.match(HEADING)
    if (headingMatch) {
      closeParagraph()
      heading = toVerse(headingMatch[1].trim(), lineNumber)
      if (heading.reference) results.push(heading)
      continue
    }

    const note = readNote(trimmed)
    if (note !== null) {
      closeParagraph()
      heading = null
      if (note) results.push({ kind: 'note', line: lineNumber, content: note })
      continue
    }

    if (heading && !/^\s/.test(raw)) {
      if (paragraph.length === 0) heading.markdownLine = lineNumber
      paragraph.push(trimmed)
      continue
    }

    // Indentation marks the verse text the old export wrote under a reference
    if (/^\s+\S/.test(raw)) continue
    // Any other heading level is a title or a comment
    if (trimmed.startsWith('#')) continue

    results.push(toVerse(trimmed, lineNumber))
  }
  closeParagraph()

  return results
}

/**
 * The text of a note line, '' for an empty note or a bare `---` separator,
 * or null when the line is not a note at all.
 */
function readNote(line: string): string | null {
  const quote = line.match(QUOTE_NOTE)
  if (quote) return quote[1].trim()
  const dashed = line.match(DASHED_NOTE)
  if (dashed) return dashed[1].trim()
  if (/^-{3,}$/.test(line)) return ''
  return null
}

/**
 * Splits off a trailing translation abbreviation. The tail must be a plain
 * word so a cross-chapter range like "Gen 1:1 - 2:5" is left intact.
 */
function toVerse(
  content: string,
  line: number,
): Extract<ParsedBookmarkLine, { kind: 'verse' }> {
  const suffixMatch = content.match(/^(.*?)\s+-\s+([A-Za-z][A-Za-z0-9]*)$/)
  return {
    kind: 'verse',
    line,
    content,
    reference: suffixMatch ? suffixMatch[1].trim() : content,
    translationAbbreviation: suffixMatch ? suffixMatch[2] : undefined,
  }
}
