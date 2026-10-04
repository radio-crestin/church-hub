import { getBookmarkNotes } from './getBookmarkNotes'
import { getBookmarks } from './getBookmarks'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Renders the bookmark list as standard Markdown.
 *
 * The format round-trips through importBookmarksFromText: each verse is a
 * `## reference - TRANSLATION` heading with the verse under it, its bold,
 * underline and highlight written as `**…**`, `<u>…</u>` and `<mark>…</mark>`;
 * a note is a `> quote`.
 */
export function exportBookmarksAsMarkdown(): string {
  try {
    logger.debug('Exporting bible bookmarks as Markdown')

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
        lines.push(`> ${item.note.content}`)
        lines.push('')
        continue
      }

      const bookmark = item.bookmark
      if (!bookmark) continue

      const suffix = bookmark.translationAbbreviation
        ? ` - ${bookmark.translationAbbreviation}`
        : ''
      lines.push(`## ${bookmark.reference}${suffix}`)
      lines.push('')
      lines.push(bookmark.markdown)
      lines.push('')
    }

    return lines.join('\n')
  } catch (error) {
    logger.error(`Failed to export bookmarks: ${error}`)
    return ''
  }
}
