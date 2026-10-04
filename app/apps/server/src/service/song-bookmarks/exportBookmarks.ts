import { asc, eq } from 'drizzle-orm'

import { formatSongHeading } from './formatSongHeading'
import { getBookmarkNotes } from './getBookmarkNotes'
import { getBookmarks } from './getBookmarks'
import { slideMarkdown } from './slideMarkdown'
import { getDatabase } from '../../db'
import { songSlides } from '../../db/schema'
import { escapeMarkdown } from '../bookmark-markdown'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmarks] ${message}`)
}

/**
 * Renders the song bookmark list as standard Markdown:
 *
 *   ## Song title {#song-12}       the song, with its id
 *
 *   *Category · key line*
 *
 *   ### Strofa 1                   each slide, under its label
 *
 *   lyrics with **bold**, *italic*, <u>underline</u>
 *
 *   > Note                         a note
 */
export function exportBookmarksAsMarkdown(): string {
  try {
    log('debug', 'Exporting song bookmarks as Markdown')

    const bookmarks = getBookmarks()
    const notes = getBookmarkNotes()
    const db = getDatabase()

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

    const blocks: string[] = []

    for (const item of items) {
      if (item.note) {
        blocks.push(`> ${item.note.content}`)
        continue
      }

      const bookmark = item.bookmark
      if (!bookmark) continue

      blocks.push(formatSongHeading(bookmark.songTitle, bookmark.songId))

      const details = [bookmark.songCategoryName, bookmark.songKeyLine]
        .filter((detail): detail is string => Boolean(detail?.trim()))
        .map((detail) => escapeMarkdown(detail.trim()))
      if (details.length > 0) blocks.push(`*${details.join(' · ')}*`)

      const slides = db
        .select({
          label: songSlides.label,
          content: songSlides.content,
          styleOverrides: songSlides.styleOverrides,
        })
        .from(songSlides)
        .where(eq(songSlides.songId, bookmark.songId))
        .orderBy(asc(songSlides.sortOrder))
        .all()

      for (const slide of slides) {
        if (slide.label?.trim()) {
          blocks.push(`### ${escapeMarkdown(slide.label.trim())}`)
        }
        const lyrics = slideMarkdown(slide.content, slide.styleOverrides)
        if (lyrics) blocks.push(lyrics)
      }
    }

    return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : ''
  } catch (error) {
    log('error', `Failed to export bookmarks: ${error}`)
    return ''
  }
}
