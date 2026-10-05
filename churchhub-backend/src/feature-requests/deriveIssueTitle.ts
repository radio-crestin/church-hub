import { DERIVED_TITLE_MAX_LENGTH } from './constants'

/**
 * The app no longer asks for a title: the issue is named after the first
 * line of the description, shortened. Older app versions still send a
 * title, which wins when present.
 */
export function deriveIssueTitle(title: string, notes: string): string {
  if (title) return title
  const firstLine =
    notes
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .find(Boolean) ?? ''
  if (firstLine.length <= DERIVED_TITLE_MAX_LENGTH) return firstLine
  return `${firstLine.slice(0, DERIVED_TITLE_MAX_LENGTH - 1).trimEnd()}…`
}
