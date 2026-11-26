import { and, eq, isNotNull } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { scheduleItems } from '../../db/schema'

/** Each presentation's `schedule` items' presentations, by its id. */
export function childScheduleIds(): Map<number, number[]> {
  const rows = getDatabase()
    .select({
      scheduleId: scheduleItems.scheduleId,
      childId: scheduleItems.childScheduleId,
    })
    .from(scheduleItems)
    .where(
      and(
        eq(scheduleItems.itemType, 'schedule'),
        isNotNull(scheduleItems.childScheduleId),
      ),
    )
    .all()
  const byId = new Map<number, number[]>()
  for (const { scheduleId, childId } of rows) {
    if (childId === null) continue
    byId.set(scheduleId, [...(byId.get(scheduleId) ?? []), childId])
  }
  return byId
}
