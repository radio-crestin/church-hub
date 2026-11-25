import { and, eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { scheduleItems } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { type ConfigurableItemType, parseItemConfig } from '../schedule-items'

const logger = createLogger('schedules')

/**
 * Changes an item's settings: a music, video or verses item's, or how many of
 * a Versete Biblice slide's passages it shows (null: all, in order). Settings
 * that don't fit the item are refused.
 */
export function setScheduleItemConfig(
  scheduleId: number,
  itemId: number,
  itemConfig: unknown,
): OperationResult {
  const db = getDatabase()
  const where = and(
    eq(scheduleItems.id, itemId),
    eq(scheduleItems.scheduleId, scheduleId),
  )
  const item = db
    .select({
      itemType: scheduleItems.itemType,
      slideType: scheduleItems.slideType,
    })
    .from(scheduleItems)
    .where(where)
    .get()
  if (!item) return { success: false, error: 'Schedule item not found' }

  const type: ConfigurableItemType | null =
    item.itemType === 'music' ||
    item.itemType === 'video' ||
    item.itemType === 'verses'
      ? item.itemType
      : item.slideType === 'versete_tineri'
        ? 'versete'
        : null
  if (!type) return { success: false, error: 'This item has no settings' }

  let json: string
  try {
    json = JSON.stringify(parseItemConfig(type, itemConfig))
  } catch (error) {
    return { success: false, error: String(error) }
  }
  db.update(scheduleItems)
    .set({ itemConfig: json, updatedAt: new Date() })
    .where(where)
    .run()
  logger.info(`Item ${itemId} of presentation ${scheduleId}: settings saved`)
  return { success: true }
}
