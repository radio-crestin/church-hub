import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { songBookmarkNotes, songBookmarks } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmarks] ${message}`)
}

export interface BookmarkItemRef {
  type: 'song' | 'note'
  id: number
}

export function reorderBookmarkItems(
  items: BookmarkItemRef[],
): OperationResult {
  try {
    log('debug', `Reordering ${items.length} bookmark items`)

    const db = getDatabase()

    db.transaction((tx) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type === 'song') {
          tx.update(songBookmarks)
            .set({ sortOrder: i })
            .where(eq(songBookmarks.id, item.id))
            .run()
        } else {
          tx.update(songBookmarkNotes)
            .set({ sortOrder: i })
            .where(eq(songBookmarkNotes.id, item.id))
            .run()
        }
      }
    })

    log('info', `Reordered ${items.length} bookmark items`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to reorder bookmark items: ${error}`)
    return { success: false, error: String(error) }
  }
}
