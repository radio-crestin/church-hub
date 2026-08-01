import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { songBookmarks } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmarks] ${message}`)
}

export function removeBookmark(bookmarkId: number): OperationResult {
  try {
    log('debug', `Removing bookmark ${bookmarkId}`)

    const db = getDatabase()
    db.delete(songBookmarks).where(eq(songBookmarks.id, bookmarkId)).run()

    log('info', `Bookmark ${bookmarkId} removed`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to remove bookmark: ${error}`)
    return { success: false, error: String(error) }
  }
}
