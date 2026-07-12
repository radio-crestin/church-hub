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

/**
 * Sets the manual "already sung" marker on a bookmarked song. `sungAt` is
 * stamped when marking sung and cleared when unmarking.
 */
export function markBookmarkSung(
  songId: number,
  isSung: boolean,
): OperationResult {
  try {
    log('debug', `Marking bookmark for song ${songId} sung=${isSung}`)

    const db = getDatabase()
    db.update(songBookmarks)
      .set({ isSung, sungAt: isSung ? new Date() : null })
      .where(eq(songBookmarks.songId, songId))
      .run()

    log('info', `Bookmark for song ${songId} marked sung=${isSung}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to mark bookmark sung: ${error}`)
    return { success: false, error: String(error) }
  }
}
