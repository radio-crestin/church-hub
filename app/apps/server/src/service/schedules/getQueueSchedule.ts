import { eq } from 'drizzle-orm'

import { getScheduleById } from './getSchedules'
import type { ScheduleWithItems } from './types'
import { getDatabase } from '../../db'
import { schedules } from '../../db/schema'

/**
 * The control room's queue: a presentation like any other, hidden from the
 * presentations list. Made the first time it is asked for.
 */
export function getQueueSchedule(): ScheduleWithItems | null {
  const db = getDatabase()
  const existing = db
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.isQueue, true))
    .get()
  const id =
    existing?.id ??
    db
      .insert(schedules)
      .values({
        title: 'Queue',
        isQueue: true,
        autoplayByText: false,
      })
      .returning({ id: schedules.id })
      .get().id
  return getScheduleById(id)
}
