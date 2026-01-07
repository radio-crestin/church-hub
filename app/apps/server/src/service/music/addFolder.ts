import { basename } from 'node:path'

import { syncFolder } from './syncFolder'
import type { AddFolderInput, MusicFolder } from './types'
import { getDatabase } from '../../db'
import { musicFolders } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/addFolder')

export async function addFolder(
  input: AddFolderInput,
): Promise<MusicFolder | null> {
  const db = getDatabase()

  const name = input.name || basename(input.path)
  const isRecursive = input.isRecursive ?? true
  const now = new Date()

  try {
    const result = db
      .insert(musicFolders)
      .values({
        path: input.path,
        name,
        isRecursive,
        fileCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    if (!result) return null

    const folder: MusicFolder = {
      id: result.id,
      path: result.path,
      name: result.name,
      isRecursive: result.isRecursive,
      lastSyncAt: null,
      fileCount: 0,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
    }

    await syncFolder(folder.id)

    const updatedRow = db
      .select()
      .from(musicFolders)
      .where((t) => t.id.equals(folder.id))
      .get()

    if (updatedRow) {
      folder.fileCount = updatedRow.fileCount
      folder.lastSyncAt = updatedRow.lastSyncAt
        ? updatedRow.lastSyncAt.getTime()
        : null
    }

    return folder
  } catch (error) {
    logger.error(`Failed to add folder: ${error}`)
    return null
  }
}
