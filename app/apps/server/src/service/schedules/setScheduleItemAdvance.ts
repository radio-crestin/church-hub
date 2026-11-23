import { and, eq } from 'drizzle-orm'

import { clampSeconds } from './clampSeconds'
import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { scheduleItems } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('schedules')

/**
 * Sets how long each slide of a presentation item stays up while it runs by
 * itself, like PowerPoint's "advance after"; null gives it back the
 * presentation's timing.
 */
export function setScheduleItemAdvance(
  scheduleId: number,
  itemId: number,
  advanceSeconds: number | null,
): OperationResult {
  const seconds = advanceSeconds === null ? null : clampSeconds(advanceSeconds)
  const result = getDatabase()
    .update(scheduleItems)
    .set({ advanceSeconds: seconds, updatedAt: new Date() })
    .where(
      and(
        eq(scheduleItems.id, itemId),
        eq(scheduleItems.scheduleId, scheduleId),
      ),
    )
    .run()
  if (result.changes === 0) {
    logger.warning(`Item ${itemId} not found in presentation ${scheduleId}`)
    return { success: false, error: 'Schedule item not found' }
  }
  logger.info(`Item ${itemId} advances after ${seconds ?? 'the default'} s`)
  return { success: true }
}
