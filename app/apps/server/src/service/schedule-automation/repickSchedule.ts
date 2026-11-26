import { broadcastSchedulePicks } from '../../websocket'
import { forgetItemPicks } from '../schedule-items'
import { flattenScheduleItems } from '../schedules/flattenScheduleItems'
import { getScheduleById } from '../schedules/getSchedules'
import type { ScheduleWithItems } from '../schedules/types'

/**
 * A presentation picks its random verses and videos again (a new run, a new
 * loop, or the operator asking for it); every page showing it reads it again.
 * Returns it with the new picks.
 */
export function repickSchedule(scheduleId: number): ScheduleWithItems | null {
  const before = getScheduleById(scheduleId)
  if (!before) return null
  forgetItemPicks(flattenScheduleItems(before.items).map((item) => item.id))
  broadcastSchedulePicks(scheduleId)
  return getScheduleById(scheduleId)
}
