import { sql } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { songBookmarkNotes } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmark-notes] ${message}`)
}

export interface BookmarkNote {
  id: number
  content: string
  sortOrder: number
  createdAt: number
}

export function addBookmarkNote(
  content: string,
): { data: BookmarkNote } | { error: string } {
  try {
    log('debug', 'Adding bookmark note')

    const db = getDatabase()

    const maxOrder = db
      .select({ max: sql<number>`MAX(sort_order)` })
      .from(songBookmarkNotes)
      .get()

    const inserted = db
      .insert(songBookmarkNotes)
      .values({
        content,
        sortOrder: (maxOrder?.max ?? -1) + 1,
      })
      .returning()
      .get()

    log('info', `Bookmark note created: ${inserted.id}`)

    return {
      data: {
        id: inserted.id,
        content: inserted.content,
        sortOrder: inserted.sortOrder,
        createdAt: inserted.createdAt.getTime(),
      },
    }
  } catch (error) {
    log('error', `Failed to add bookmark note: ${error}`)
    return { error: String(error) }
  }
}
