import { getBookmarkNotes } from './getBookmarkNotes'
import { getBookmarks } from './getBookmarks'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Renders the bookmark list as plain text.
 *
 * The format round-trips through importBookmarksFromText: a reference sits on
 * its own line, the verse text is indented underneath it (indentation is what
 * marks a line as text rather than a reference), and notes are wrapped in
 * dashes.
 */
export function exportBookmarksAsText(): string {
  try {
    logger.debug('Exporting bible bookmarks as text')

    const bookmarks = getBookmarks()
    const notes = getBookmarkNotes()

    const items = [
      ...bookmarks.map((bookmark) => ({
        sortOrder: bookmark.sortOrder,
        bookmark,
        note: undefined,
      })),
      ...notes.map((note) => ({
        sortOrder: note.sortOrder,
        bookmark: undefined,
        note,
      })),
    ].sort((a, b) => a.sortOrder - b.sortOrder)

    const lines: string[] = []

    for (const item of items) {
      if (item.note) {
        lines.push(`--- ${item.note.content} ---`)
        lines.push('')
        continue
      }

      const bookmark = item.bookmark
      if (!bookmark) continue

      const suffix = bookmark.translationAbbreviation
        ? ` - ${bookmark.translationAbbreviation}`
        : ''
      lines.push(`${bookmark.reference}${suffix}`)
      lines.push(`    ${bookmark.text}`)
      lines.push('')
    }

    return lines.join('\n')
  } catch (error) {
    logger.error(`Failed to export bookmarks: ${error}`)
    return ''
  }
}
