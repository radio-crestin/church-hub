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

export function removeBookmark(songId: number): OperationResult {
  try {
    log('debug', `Removing bookmark for song ${songId}`)

    const db = getDatabase()
    db.delete(songBookmarks).where(eq(songBookmarks.songId, songId)).run()

    log('info', `Bookmark removed for song ${songId}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to remove bookmark: ${error}`)
    return { success: false, error: String(error) }
  }
}
