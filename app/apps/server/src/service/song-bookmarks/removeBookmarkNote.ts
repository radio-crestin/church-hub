import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { songBookmarkNotes } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmark-notes] ${message}`)
}

export function removeBookmarkNote(id: number): OperationResult {
  try {
    log('debug', `Removing bookmark note ${id}`)

    const db = getDatabase()
    db.delete(songBookmarkNotes).where(eq(songBookmarkNotes.id, id)).run()

    log('info', `Bookmark note ${id} removed`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to remove bookmark note: ${error}`)
    return { success: false, error: String(error) }
  }
}
