import { eq } from 'drizzle-orm'

import type { MusicFolder, OperationResult } from './types'
import { getDatabase } from '../../db'
import { musicFolders } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/renameFolder')

export interface RenameFolderInput {
  id: number
  name: string
}

export function renameFolder(
  input: RenameFolderInput,
): OperationResult<MusicFolder> {
  const db = getDatabase()

  try {
    const result = db
      .update(musicFolders)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(musicFolders.id, input.id))
      .returning()
      .get()

    if (!result) {
      return { success: false, error: 'Folder not found' }
    }

    return {
      success: true,
      data: {
        id: result.id,
        path: result.path,
        name: result.name,
        isRecursive: result.isRecursive,
        lastSyncAt: result.lastSyncAt ? result.lastSyncAt.getTime() : null,
        fileCount: result.fileCount,
        createdAt: result.createdAt.getTime(),
        updatedAt: result.updatedAt.getTime(),
      },
    }
  } catch (error) {
    logger.error(`Failed to rename folder: ${error}`)
    return { success: false, error: String(error) }
  }
}
