import { eq } from 'drizzle-orm'

import { scheduleContains } from './scheduleContains'
import { getDatabase } from '../../db'
import { schedules } from '../../db/schema'

/**
 * Throws unless presentation `childId` can play inside `scheduleId`: it
 * exists, is not the control room's queue, and neither is nor includes
 * `scheduleId` (that would make a loop).
 */
export function assertNestable(scheduleId: number, childId: number): void {
  const child = getDatabase()
    .select({ isQueue: schedules.isQueue })
    .from(schedules)
    .where(eq(schedules.id, childId))
    .get()
  if (!child) throw new Error(`Presentation ${childId} not found`)
  if (child.isQueue) {
    throw new Error('The queue cannot be added to a presentation')
  }
  if (scheduleContains(childId, scheduleId)) {
    throw new Error(
      `Presentation ${childId} is or includes presentation ${scheduleId}: adding it would make a loop`,
    )
  }
}
