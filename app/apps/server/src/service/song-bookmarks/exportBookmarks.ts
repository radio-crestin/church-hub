import { asc, eq } from 'drizzle-orm'

import { getBookmarkNotes } from './getBookmarkNotes'
import { getBookmarks } from './getBookmarks'
import { getDatabase } from '../../db'
import { songSlides } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmarks] ${message}`)
}

export interface BookmarkExportItem {
  type: 'song' | 'note'
  sortOrder: number
  content: string
  songTitle?: string
  songCategory?: string | null
  songKeyLine?: string | null
  slides?: Array<{ label: string | null; content: string }>
}

export function exportBookmarksAsText(): string {
  try {
    log('debug', 'Exporting bookmarks as text')

    const bookmarks = getBookmarks()
    const notes = getBookmarkNotes()
    const db = getDatabase()

    // Merge bookmarks and notes by sortOrder
    const items: Array<{
      type: 'song' | 'note'
      sortOrder: number
      bookmark?: (typeof bookmarks)[0]
      note?: (typeof notes)[0]
    }> = [
      ...bookmarks.map((b) => ({
        type: 'song' as const,
        sortOrder: b.sortOrder,
        bookmark: b,
      })),
      ...notes.map((n) => ({
        type: 'note' as const,
        sortOrder: n.sortOrder,
        note: n,
      })),
    ].sort((a, b) => a.sortOrder - b.sortOrder)

    const lines: string[] = []

    for (const item of items) {
      if (item.type === 'note' && item.note) {
        lines.push(`--- ${item.note.content} ---`)
        lines.push('')
      } else if (item.type === 'song' && item.bookmark) {
        const b = item.bookmark
        lines.push(`# ${b.songTitle}`)
        if (b.songCategoryName) {
          lines.push(`  ${b.songCategoryName}`)
        }
        if (b.songKeyLine) {
          lines.push(`  ${b.songKeyLine}`)
        }

        // Fetch slides for this song
        const slides = db
          .select({
            label: songSlides.label,
            content: songSlides.content,
          })
          .from(songSlides)
          .where(eq(songSlides.songId, b.songId))
          .orderBy(asc(songSlides.sortOrder))
          .all()

        for (const slide of slides) {
          lines.push('')
          if (slide.label) {
            lines.push(`[${slide.label}]`)
          }
          lines.push(slide.content)
        }

        lines.push('')
        lines.push('---')
        lines.push('')
      }
    }

    return lines.join('\n')
  } catch (error) {
    log('error', `Failed to export bookmarks: ${error}`)
    return ''
  }
}
