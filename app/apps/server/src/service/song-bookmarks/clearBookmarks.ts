import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { songBookmarks } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmarks] ${message}`)
}

export function clearBookmarks(): OperationResult {
  try {
    log('debug', 'Clearing all bookmarks')

    const db = getDatabase()
    db.delete(songBookmarks).run()

    log('info', 'All bookmarks cleared')
    return { success: true }
  } catch (error) {
    log('error', `Failed to clear bookmarks: ${error}`)
    return { success: false, error: String(error) }
  }
}
