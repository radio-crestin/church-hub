import { eq, sql } from 'drizzle-orm'

import type { OperationResult, ReorderQueueInput } from './types'
import { getDatabase } from '../../db'
import { presentationQueue } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Reorders queue items based on the new order of IDs
 */
export function reorderQueue(input: ReorderQueueInput): OperationResult {
  try {
    log('debug', `Reordering queue: ${input.itemIds.join(', ')}`)

    const db = getDatabase()

    for (let i = 0; i < input.itemIds.length; i++) {
      db.update(presentationQueue)
        .set({
          sortOrder: i,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(eq(presentationQueue.id, input.itemIds[i]))
        .run()
    }

    log('info', 'Queue reordered successfully')
    return { success: true }
  } catch (error) {
    log('error', `Failed to reorder queue: ${error}`)
    return { success: false, error: String(error) }
  }
}
