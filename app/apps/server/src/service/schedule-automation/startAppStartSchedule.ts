import { eq } from 'drizzle-orm'

import { startScheduleAutomation } from './scheduleAutomation'
import { getDatabase } from '../../db'
import { schedules } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('schedule-automation')

/**
 * Starts the presentation marked "start when Church Hub starts", if there is
 * one. Called once the server is ready.
 */
export async function startAppStartSchedule(): Promise<void> {
  const row = getDatabase()
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.startOnAppStart, true))
    .get()
  if (!row) return

  logger.info(`Starting presentation ${row.id} with the app`)
  try {
    await startScheduleAutomation(row.id)
  } catch (error) {
    logger.error(`Could not start presentation ${row.id}: ${error}`)
  }
}
