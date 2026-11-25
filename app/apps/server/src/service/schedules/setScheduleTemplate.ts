import { and, eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { getSlideTemplate } from '../slide-templates/getSlideTemplates'

const logger = createLogger('schedules')

function checkTemplate(templateId: number | null): OperationResult | null {
  if (templateId === null || getSlideTemplate(templateId)) return null
  return { success: false, error: 'Template not found' }
}

/** The template a presentation's slides are drawn with; null: each screen's own. */
export function setScheduleTemplate(
  scheduleId: number,
  templateId: number | null,
): OperationResult {
  const invalid = checkTemplate(templateId)
  if (invalid) return invalid
  const updated = getDatabase()
    .update(schedules)
    .set({ templateId, updatedAt: new Date() })
    .where(eq(schedules.id, scheduleId))
    .returning({ id: schedules.id })
    .all()
  if (updated.length === 0) {
    return { success: false, error: 'Schedule not found' }
  }
  logger.info(`Presentation ${scheduleId} → template ${templateId ?? 'none'}`)
  return { success: true }
}

/** One item's own template; null: the presentation's. */
export function setScheduleItemTemplate(
  scheduleId: number,
  itemId: number,
  templateId: number | null,
): OperationResult {
  const invalid = checkTemplate(templateId)
  if (invalid) return invalid
  const updated = getDatabase()
    .update(scheduleItems)
    .set({ templateId, updatedAt: new Date() })
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
  logger.info(`Item ${itemId} → template ${templateId ?? 'the presentation’s'}`)
  return { success: true }
}
