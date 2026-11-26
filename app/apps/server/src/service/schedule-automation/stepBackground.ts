import { buildScheduleSteps } from './buildScheduleSteps'
import type { PresentationBackground } from '../presentation/types'
import { isBackgroundVideo } from '../schedule-items/isBackgroundVideo'
import { flattenScheduleItems } from '../schedules/flattenScheduleItems'
import { getScheduleById } from '../schedules/getSchedules'

/**
 * The looping video behind a presentation's step: the last video item before
 * it set as a background; null when there is none.
 */
export function stepBackground(
  scheduleId: number,
  stepIndex: number,
): PresentationBackground | null {
  const schedule = getScheduleById(scheduleId)
  const step = schedule && buildScheduleSteps(schedule.items)[stepIndex]
  if (!schedule || !step) return null
  const items = flattenScheduleItems(schedule.items)
  const at = items.findIndex((item) => item.id === step.item.id)
  const background = items.slice(0, at).reverse().find(isBackgroundVideo)
  return background?.video ? { url: background.video.url } : null
}
