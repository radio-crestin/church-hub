import { and, eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { scheduleItems } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('schedules')

export interface ScheduleItemMidiInput {
  hash: string
  fileName: string
  durationSeconds: number
}

/**
 * Attaches a MIDI file to a song item of a presentation (null takes it off).
 * A new file starts with its slides split evenly: times synced for another
 * file would not fit it.
 */
export function setScheduleItemMidi(
  scheduleId: number,
  itemId: number,
  midi: ScheduleItemMidiInput | null,
): OperationResult {
  const updated = getDatabase()
    .update(scheduleItems)
    .set({
      midiFile: midi?.hash ?? null,
      midiFileName: midi?.fileName ?? null,
      midiDurationSeconds: midi?.durationSeconds ?? null,
      midiVerseTimes: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduleItems.id, itemId),
        eq(scheduleItems.scheduleId, scheduleId),
        eq(scheduleItems.itemType, 'song'),
      ),
    )
    .returning({ id: scheduleItems.id })
    .all()
  if (updated.length === 0) {
    logger.warning(
      `Song item ${itemId} not found in presentation ${scheduleId}`,
    )
    return { success: false, error: 'Schedule item not found' }
  }
  logger.info(
    midi
      ? `Item ${itemId} plays MIDI ${midi.fileName} (${midi.hash.slice(0, 8)})`
      : `Item ${itemId} has no MIDI anymore`,
  )
  return { success: true }
}

/** Saves the second each slide of the item starts at; null splits them evenly. */
export function setScheduleItemMidiVerseTimes(
  scheduleId: number,
  itemId: number,
  verseTimes: number[] | null,
): OperationResult {
  const updated = getDatabase()
    .update(scheduleItems)
    .set({
      midiVerseTimes: verseTimes ? JSON.stringify(verseTimes) : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduleItems.id, itemId),
        eq(scheduleItems.scheduleId, scheduleId),
      ),
    )
    .returning({ id: scheduleItems.id })
    .all()
  if (updated.length === 0) {
    return { success: false, error: 'Schedule item not found' }
  }
  logger.info(
    `Item ${itemId} MIDI verse times: ${verseTimes ? verseTimes.join(', ') : 'split evenly'}`,
  )
  return { success: true }
}
