import { eq } from 'drizzle-orm'

import type { MusicPlaylist, UpsertPlaylistInput } from './types'
import { getDatabase } from '../../db'
import { musicPlaylists } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('music/upsertPlaylist')

export function upsertPlaylist(
  input: UpsertPlaylistInput,
): MusicPlaylist | null {
  const db = getDatabase()
  const now = new Date()

  try {
    if (input.id) {
      const existing = db
        .select()
        .from(musicPlaylists)
        .where(eq(musicPlaylists.id, input.id))
        .get()

      if (!existing) return null

      db.update(musicPlaylists)
        .set({
          name: input.name,
          description: input.description ?? existing.description,
          updatedAt: now,
        })
        .where(eq(musicPlaylists.id, input.id))
        .run()

      const updated = db
        .select()
        .from(musicPlaylists)
        .where(eq(musicPlaylists.id, input.id))
        .get()

      if (!updated) return null

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        itemCount: updated.itemCount,
        totalDuration: updated.totalDuration,
        createdAt: updated.createdAt.getTime(),
        updatedAt: updated.updatedAt.getTime(),
      }
    }

    const result = db
      .insert(musicPlaylists)
      .values({
        name: input.name,
        description: input.description ?? null,
        itemCount: 0,
        totalDuration: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    if (!result) return null

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      itemCount: result.itemCount,
      totalDuration: result.totalDuration,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
    }
  } catch (error) {
    logger.error(`Failed: ${error}`)
    return null
  }
}
