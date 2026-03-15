import { asc } from 'drizzle-orm'

import type { BookmarkNote } from './addBookmarkNote'
import { getDatabase } from '../../db'
import { songBookmarkNotes } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmark-notes] ${message}`)
}

export function getBookmarkNotes(): BookmarkNote[] {
  try {
    log('debug', 'Getting bookmark notes')

    const db = getDatabase()
    const records = db
      .select()
      .from(songBookmarkNotes)
      .orderBy(asc(songBookmarkNotes.sortOrder))
      .all()

    return records.map((r) => ({
      id: r.id,
      content: r.content,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.getTime(),
    }))
  } catch (error) {
    log('error', `Failed to get bookmark notes: ${error}`)
    return []
  }
}
