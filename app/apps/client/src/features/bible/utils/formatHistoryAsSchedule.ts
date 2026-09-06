import type { BibleHistoryItem } from '../types'

interface FormatHistoryOptions {
  /** First comment line of the file, e.g. "Bible History — last session". */
  title: string
  /** Second comment line explaining the schedule syntax. */
  help: string
}

/**
 * Renders history items as a schedule text file: one `Reference [V]` line per
 * verse, newest first, with the verse text kept underneath as a comment (the
 * schedule parser ignores `#` lines).
 */
export function formatHistoryAsSchedule(
  items: BibleHistoryItem[],
  { title, help }: FormatHistoryOptions,
): string {
  const lines: string[] = [`# ${title}`, `# ${help}`, '']

  const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt)

  for (const item of sortedItems) {
    // Drop the translation suffix so the parser sees a plain reference
    // ("Ioan 3:16 - VDCC" -> "Ioan 3:16").
    const refWithoutTranslation = item.reference
      .replace(/\s*-\s*[A-Z]+$/, '')
      .trim()
    lines.push(`${refWithoutTranslation} [V]`)
    lines.push(`# ${item.text}`)
    lines.push('')
  }

  return lines.join('\n')
}
