import { eq } from 'drizzle-orm'

import type { OperationResult, ReorderPlaylistItemsInput } from './types'
import { getDatabase } from '../../db'
import { musicPlaylistItems } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/reorderPlaylistItems')

export function reorderPlaylistItems(
  playlistId: number,
  input: ReorderPlaylistItemsInput,
): OperationResult {
  const db = getDatabase()

  try {
    const items = db
      .select()
      .from(musicPlaylistItems)
      .where(eq(musicPlaylistItems.playlistId, playlistId))
      .all()

    const itemMap = new Map(items.map((item) => [item.id, item]))

    for (const itemId of input.itemIds) {
      if (!itemMap.has(itemId)) {
        return { success: false, error: `Item ${itemId} not found in playlist` }
      }
    }

    for (let i = 0; i < input.itemIds.length; i++) {
      const itemId = input.itemIds[i]
      db.update(musicPlaylistItems)
        .set({ sortOrder: i })
        .where(eq(musicPlaylistItems.id, itemId))
        .run()
    }

    return { success: true }
  } catch (error) {
    logger.error(`Failed: ${error}`)
    return { success: false, error: String(error) }
  }
}
