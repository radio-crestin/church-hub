import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { presentationQueue } from '../../db/schema/presentation'
import { scheduleItems } from '../../db/schema/schedules'
import { songs } from '../../db/schema/songs'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [songs] ${message}`)
}

export interface ReplaceSongReferencesResult {
  success: boolean
  scheduleItemsUpdated: number
  queueItemsUpdated: number
  error?: string
}

/**
 * Replaces all references to oldSongId with newSongId in schedules and queue,
 * then deletes the old song.
 *
 * This is used when a user wants to save a song with a title that already exists:
 * - The existing song (oldSongId) will be deleted
 * - All schedule items and queue items referencing oldSongId will now reference newSongId
 */
export function replaceSongReferences(
  oldSongId: number,
  newSongId: number,
): ReplaceSongReferencesResult {
  try {
    log('info', `Replacing song references: ${oldSongId} -> ${newSongId}`)

    const db = getDatabase()

    // Update schedule items
    const scheduleResult = db
      .update(scheduleItems)
      .set({ songId: newSongId })
      .where(eq(scheduleItems.songId, oldSongId))
      .run()

    const scheduleItemsUpdated = scheduleResult.changes

    // Update queue items
    const queueResult = db
      .update(presentationQueue)
      .set({ songId: newSongId })
      .where(eq(presentationQueue.songId, oldSongId))
      .run()

    const queueItemsUpdated = queueResult.changes

    log(
      'info',
      `Updated ${scheduleItemsUpdated} schedule items and ${queueItemsUpdated} queue items`,
    )

    // Delete the old song (slides will cascade delete)
    db.delete(songs).where(eq(songs.id, oldSongId)).run()

    log('info', `Deleted old song: ${oldSongId}`)

    return {
      success: true,
      scheduleItemsUpdated,
      queueItemsUpdated,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('error', `Failed to replace song references: ${message}`)
    return {
      success: false,
      scheduleItemsUpdated: 0,
      queueItemsUpdated: 0,
      error: message,
    }
  }
}
