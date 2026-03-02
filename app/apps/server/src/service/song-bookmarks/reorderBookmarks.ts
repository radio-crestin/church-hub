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

export function reorderBookmarks(songIds: number[]): OperationResult {
  try {
    log('debug', `Reordering ${songIds.length} bookmarks`)

    const db = getDatabase()

    db.transaction((tx) => {
      for (let i = 0; i < songIds.length; i++) {
        tx.update(songBookmarks)
          .set({ sortOrder: i })
          .where(eq(songBookmarks.songId, songIds[i]))
          .run()
      }
    })

    log('info', `Reordered ${songIds.length} bookmarks`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to reorder bookmarks: ${error}`)
    return { success: false, error: String(error) }
  }
}
