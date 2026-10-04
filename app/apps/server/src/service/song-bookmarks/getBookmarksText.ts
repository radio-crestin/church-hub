import { formatSongHeading } from './formatSongHeading'
import { getBookmarkNotes } from './getBookmarkNotes'
import { getBookmarks } from './getBookmarks'

/**
 * The song Marcaje list as the text editor shows it: the same Markdown as the
 * export, one line per item and without the lyrics.
 *
 *   ## Cât de mare ești {#song-12}
 *   > Final
 */
export function getBookmarksText(): string {
  const lines = [
    ...getBookmarks().map((bookmark) => ({
      sortOrder: bookmark.sortOrder,
      line: formatSongHeading(bookmark.songTitle, bookmark.songId),
    })),
    ...getBookmarkNotes().map((note) => ({
      sortOrder: note.sortOrder,
      line: `> ${note.content}`,
    })),
  ]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.line)

  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}
