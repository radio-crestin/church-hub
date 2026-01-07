import { eq, max, sql } from 'drizzle-orm'

import type { AddToPlaylistInput, OperationResult } from './types'
import { getDatabase } from '../../db'
import { musicFiles, musicPlaylistItems, musicPlaylists } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/addToPlaylist')

export function addToPlaylist(input: AddToPlaylistInput): OperationResult {
  const db = getDatabase()
  const now = new Date()

  try {
    const playlist = db
      .select()
      .from(musicPlaylists)
      .where(eq(musicPlaylists.id, input.playlistId))
      .get()

    if (!playlist) {
      return { success: false, error: 'Playlist not found' }
    }

    const file = db
      .select()
      .from(musicFiles)
      .where(eq(musicFiles.id, input.fileId))
      .get()

    if (!file) {
      return { success: false, error: 'File not found' }
    }

    let sortOrder = 0

    if (input.afterItemId) {
      const afterItem = db
        .select()
        .from(musicPlaylistItems)
        .where(eq(musicPlaylistItems.id, input.afterItemId))
        .get()

      if (afterItem && afterItem.playlistId === input.playlistId) {
        sortOrder = afterItem.sortOrder + 1

        db.update(musicPlaylistItems)
          .set({
            sortOrder: sql`${musicPlaylistItems.sortOrder} + 1`,
          })
          .where(
            sql`${musicPlaylistItems.playlistId} = ${input.playlistId} AND ${musicPlaylistItems.sortOrder} >= ${sortOrder}`,
          )
          .run()
      }
    } else {
      const maxResult = db
        .select({ maxOrder: max(musicPlaylistItems.sortOrder) })
        .from(musicPlaylistItems)
        .where(eq(musicPlaylistItems.playlistId, input.playlistId))
        .get()

      sortOrder = (maxResult?.maxOrder ?? -1) + 1
    }

    db.insert(musicPlaylistItems)
      .values({
        playlistId: input.playlistId,
        fileId: input.fileId,
        sortOrder,
        createdAt: now,
      })
      .run()

    const itemCount = playlist.itemCount + 1
    const totalDuration = playlist.totalDuration + (file.duration ?? 0)

    db.update(musicPlaylists)
      .set({
        itemCount,
        totalDuration,
        updatedAt: now,
      })
      .where(eq(musicPlaylists.id, input.playlistId))
      .run()

    return { success: true }
  } catch (error) {
    logger.error(`Failed: ${error}`)
    return { success: false, error: String(error) }
  }
}
