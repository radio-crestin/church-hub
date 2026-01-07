import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { musicPlaylists } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/deletePlaylist')

export function deletePlaylist(id: number): OperationResult {
  const db = getDatabase()

  try {
    const result = db
      .delete(musicPlaylists)
      .where(eq(musicPlaylists.id, id))
      .returning()
      .get()

    if (!result) {
      return { success: false, error: 'Playlist not found' }
    }

    return { success: true }
  } catch (error) {
    logger.error(`Failed: ${error}`)
    return { success: false, error: String(error) }
  }
}
