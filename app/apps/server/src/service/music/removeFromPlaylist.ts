import { eq, sql } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { musicFiles, musicPlaylistItems, musicPlaylists } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/removeFromPlaylist')

export function removeFromPlaylist(
  playlistId: number,
  itemId: number,
): OperationResult {
  const db = getDatabase()
  const now = new Date()

  try {
    const item = db
      .select({
        item: musicPlaylistItems,
        file: musicFiles,
      })
      .from(musicPlaylistItems)
      .innerJoin(musicFiles, eq(musicPlaylistItems.fileId, musicFiles.id))
      .where(eq(musicPlaylistItems.id, itemId))
      .get()

    if (!item || item.item.playlistId !== playlistId) {
      return { success: false, error: 'Item not found in playlist' }
    }

    const playlist = db
      .select()
      .from(musicPlaylists)
      .where(eq(musicPlaylists.id, playlistId))
      .get()

    if (!playlist) {
      return { success: false, error: 'Playlist not found' }
    }

    db.delete(musicPlaylistItems).where(eq(musicPlaylistItems.id, itemId)).run()

    db.update(musicPlaylistItems)
      .set({
        sortOrder: sql`${musicPlaylistItems.sortOrder} - 1`,
      })
      .where(
        sql`${musicPlaylistItems.playlistId} = ${playlistId} AND ${musicPlaylistItems.sortOrder} > ${item.item.sortOrder}`,
      )
      .run()

    const itemCount = Math.max(0, playlist.itemCount - 1)
    const totalDuration = Math.max(
      0,
      playlist.totalDuration - (item.file.duration ?? 0),
    )

    db.update(musicPlaylists)
      .set({
        itemCount,
        totalDuration,
        updatedAt: now,
      })
      .where(eq(musicPlaylists.id, playlistId))
      .run()

    return { success: true }
  } catch (error) {
    logger.error(`Failed: ${error}`)
    return { success: false, error: String(error) }
  }
}
