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

export function updateBookmarkNote(
  id: number,
  content: string,
): OperationResult {
  try {
    log('debug', `Updating bookmark note ${id}`)

    const db = getDatabase()
    db.update(songBookmarkNotes)
      .set({ content })
      .where(eq(songBookmarkNotes.id, id))
      .run()

    log('info', `Bookmark note ${id} updated`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to update bookmark note: ${error}`)
    return { success: false, error: String(error) }
  }
}
