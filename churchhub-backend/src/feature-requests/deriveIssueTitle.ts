import { DERIVED_TITLE_MAX_LENGTH, FALLBACK_ISSUE_TITLE } from './constants'

/**
 * The app does not ask for a title. The issue is named after the first line
 * of the description, else the first note on the screenshot, shortened.
 * Older app versions still send a title, which wins when present.
 */
export function deriveIssueTitle(
  title: string,
  notes: string,
  screenshotNotes: string[]
): string {
  if (title) return title
  const firstLine =
    [...notes.split('\n'), ...screenshotNotes]
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .find(Boolean) ?? FALLBACK_ISSUE_TITLE
  if (firstLine.length <= DERIVED_TITLE_MAX_LENGTH) return firstLine
  return `${firstLine.slice(0, DERIVED_TITLE_MAX_LENGTH - 1).trimEnd()}…`
}
