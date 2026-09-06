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
    }
  | { kind: 'note'; line: number; content: string }

/**
 * Splits pasted text into verse references and notes.
 *
 * Pure text handling only - nothing here touches the database, so the rules
 * stay easy to test:
 *   - blank lines and lines starting with `#` are ignored
 *   - `--- something ---` is a note
 *   - an indented line is verse text belonging to the reference above it
 *   - anything else is a reference, optionally suffixed with ` - ABBR`
 */
export function parseBookmarksText(text: string): ParsedBookmarkLine[] {
  const results: ParsedBookmarkLine[] = []
  const lines = text.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const lineNumber = i + 1

    // Indentation marks the verse text that export writes under a reference
    if (/^\s+\S/.test(raw)) continue

    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const noteMatch = trimmed.match(/^-{3,}\s*(.*?)\s*-{3,}$/)
    if (noteMatch) {
      const content = noteMatch[1].trim()
      if (content) {
        results.push({ kind: 'note', line: lineNumber, content })
      }
      continue
    }

    // A bare `---` separator carries no content
    if (/^-{3,}$/.test(trimmed)) continue

    // Split off a trailing translation abbreviation. The tail must be a plain
    // word so a cross-chapter range like "Gen 1:1 - 2:5" is left intact.
    const suffixMatch = trimmed.match(/^(.*?)\s+-\s+([A-Za-z][A-Za-z0-9]*)$/)
    const reference = suffixMatch ? suffixMatch[1].trim() : trimmed
    const translationAbbreviation = suffixMatch ? suffixMatch[2] : undefined

    results.push({
      kind: 'verse',
      line: lineNumber,
      content: trimmed,
      reference,
      translationAbbreviation,
    })
  }

  return results
}
