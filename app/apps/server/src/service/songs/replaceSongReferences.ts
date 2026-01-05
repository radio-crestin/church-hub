import { eq } from 'drizzle-orm'

import { getDatabase, getRawDatabase } from '../../db'
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
  error?: string
}

/**
 * Prepares for song replacement by temporarily renaming the old song's title.
 * This allows a new song with the same title to be created.
 * Call this BEFORE creating the new song.
 */
export function prepareForSongReplacement(oldSongId: number): boolean {
  try {
    log(
      'info',
      `Preparing for song replacement: temporarily renaming song ${oldSongId}`,
    )

    const db = getDatabase()

    // Rename the old song's title to something unique to avoid UNIQUE constraint
    const tempTitle = `__REPLACING__${oldSongId}__${Date.now()}`
    db.update(songs)
      .set({ title: tempTitle })
      .where(eq(songs.id, oldSongId))
      .run()

    log('debug', `Temporarily renamed song ${oldSongId} to: ${tempTitle}`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('error', `Failed to prepare for song replacement: ${message}`)
    return false
  }
}

/**
 * Completes song replacement by updating all references from oldSongId to newSongId,
 * then deleting the old song.
 * Call this AFTER creating the new song.
 */
export function completeSongReplacement(
  oldSongId: number,
  newSongId: number,
): ReplaceSongReferencesResult {
  try {
    log('info', `Completing song replacement: ${oldSongId} -> ${newSongId}`)

    const rawDb = getRawDatabase()

    // Use a transaction to ensure atomicity
    const result = rawDb.transaction(() => {
      const db = getDatabase()

      // Update schedule items
      const scheduleResult = db
        .update(scheduleItems)
        .set({ songId: newSongId })
        .where(eq(scheduleItems.songId, oldSongId))
        .run()

      const scheduleItemsUpdated = scheduleResult.changes

      log('info', `Updated ${scheduleItemsUpdated} schedule items`)

      // Delete the old song (slides will cascade delete)
      db.delete(songs).where(eq(songs.id, oldSongId)).run()

      log('info', `Deleted old song: ${oldSongId}`)

      return { scheduleItemsUpdated }
    })()

    return {
      success: true,
      scheduleItemsUpdated: result.scheduleItemsUpdated,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('error', `Failed to complete song replacement: ${message}`)
    return {
      success: false,
      scheduleItemsUpdated: 0,
      error: message,
    }
  }
}

/**
 * @deprecated Use prepareForSongReplacement + completeSongReplacement instead
 */
export function replaceSongReferences(
  oldSongId: number,
  newSongId: number,
): ReplaceSongReferencesResult {
  return completeSongReplacement(oldSongId, newSongId)
}
