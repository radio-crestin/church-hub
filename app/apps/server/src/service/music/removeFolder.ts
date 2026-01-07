import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { musicFolders } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/removeFolder')

export function removeFolder(id: number): OperationResult {
  const db = getDatabase()

  try {
    const result = db
      .delete(musicFolders)
      .where(eq(musicFolders.id, id))
      .returning()
      .get()

    if (!result) {
      return { success: false, error: 'Folder not found' }
    }

    return { success: true }
  } catch (error) {
    logger.error(`Failed to remove folder: ${error}`)
    return { success: false, error: String(error) }
  }
}
