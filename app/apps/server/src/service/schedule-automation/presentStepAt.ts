import { buildScheduleSteps } from './buildScheduleSteps'
import { presentScheduleStep } from './presentScheduleStep'
import { broadcastPresentationState } from '../../websocket'
import type { PresentationState } from '../presentation/types'
import { flattenScheduleItems } from '../schedules/flattenScheduleItems'
import { getScheduleById } from '../schedules/getSchedules'
import { endScreenShareSession } from '../screen-share/session'

/**
 * Puts a presentation's step up by its position, as its runner does: for the
 * pages, a step only the server can build (a video). Null when there is no
 * such step.
 */
export async function presentStepAt(
  scheduleId: number,
  stepIndex: number,
): Promise<PresentationState | null> {
  const schedule = getScheduleById(scheduleId)
  const step = schedule && buildScheduleSteps(schedule.items)[stepIndex]
  if (!schedule || !step) return null
  endScreenShareSession()
  const state = await presentScheduleStep(
    scheduleId,
    flattenScheduleItems(schedule.items),
    step,
    stepIndex,
  )
  broadcastPresentationState(state)
  return state
}
