import { and, eq, ne } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules, slideTemplates } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { getSlideTemplate } from '../slide-templates/getSlideTemplates'

const logger = createLogger('schedules')

/** An item may draw with a shared theme, never with a presentation's own. */
function checkTemplate(templateId: number | null): OperationResult | null {
  if (templateId === null) return null
  const template = getSlideTemplate(templateId)
  if (!template || template.scheduleId !== null) {
    return { success: false, error: 'Template not found' }
  }
  return null
}

/**
 * A presentation's theme: its own copy of the theme chosen, which it then
 * changes without touching anyone else's; null: each screen's own. Choosing
 * again replaces the copy (CH-184).
 */
export function setScheduleTemplate(
  scheduleId: number,
  templateId: number | null,
): OperationResult {
  const db = getDatabase()
  const schedule = db
    .select({ title: schedules.title, templateId: schedules.templateId })
    .from(schedules)
    .where(eq(schedules.id, scheduleId))
    .get()
  if (!schedule) return { success: false, error: 'Schedule not found' }
  const source = templateId === null ? null : getSlideTemplate(templateId)
  if (templateId !== null && !source) {
    return { success: false, error: 'Template not found' }
  }
  // Already its own: nothing to copy.
  if (source?.scheduleId === scheduleId) return { success: true }
  if (source && source.scheduleId !== null) {
    return { success: false, error: 'Template not found' }
  }

  db.transaction(() => {
    const own = source
      ? db
          .insert(slideTemplates)
          .values({
            name: schedule.title,
            scheduleId,
            width: source.width,
            height: source.height,
            layouts: JSON.stringify(source.layouts),
            globalSettings: JSON.stringify(source.globalSettings),
            nextSlide: JSON.stringify(source.nextSlide),
          })
          .returning({ id: slideTemplates.id })
          .get().id
      : null
    db.update(schedules)
      .set({ templateId: own, updatedAt: new Date() })
      .where(eq(schedules.id, scheduleId))
      .run()
    // The copy it had before goes; a shared theme it pointed to stays.
    db.delete(slideTemplates)
      .where(
        and(
          eq(slideTemplates.scheduleId, scheduleId),
          own === null ? undefined : ne(slideTemplates.id, own),
        ),
      )
      .run()
  })
  logger.info(
    `Presentation ${scheduleId} → ${source ? `its own copy of template ${source.id}` : 'each screen’s own'}`,
  )
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
