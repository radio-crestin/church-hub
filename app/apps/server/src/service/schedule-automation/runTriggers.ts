import { type AutomationEvent, matchesTrigger } from './matchesTrigger'
import {
  liveScheduleId,
  startScheduleAutomation,
  stopSchedule,
} from './scheduleAutomation'
import { createLogger } from '../../utils/logger'
import { getSchedules } from '../schedules/getSchedules'

const logger = createLogger('schedule-automation')

/** Events are handled one at a time, in the order they happened. */
let queue: Promise<void> = Promise.resolve()

function describe(happened: AutomationEvent) {
  return happened.sceneName
    ? `${happened.event} "${happened.sceneName}"`
    : happened.event
}

async function handle(happened: AutomationEvent) {
  const schedules = getSchedules().sort((a, b) => a.id - b.id)

  const live = liveScheduleId()
  const toStop = schedules.find(
    (s) => s.id === live && matchesTrigger(s.automation.stopTrigger, happened),
  )
  if (toStop) stopSchedule(toStop.id, `stop trigger ${describe(happened)}`)

  const toStart = schedules.find(
    (s) =>
      s.id !== liveScheduleId() &&
      matchesTrigger(s.automation.startTrigger, happened) &&
      !matchesTrigger(s.automation.stopTrigger, happened),
  )
  if (!toStart) return
  logger.info(
    `Presentation ${toStart.id} started by its trigger: ${describe(happened)}`,
  )
  await startScheduleAutomation(toStart.id)
}

/**
 * Starts and stops the presentations whose triggers match what happened in
 * OBS. A presentation already on screen is not started again, so a scene its
 * own step selects does not restart it.
 */
export function runTriggers(happened: AutomationEvent): Promise<void> {
  queue = queue
    .then(() => handle(happened))
    .catch((error) => {
      logger.error(`Trigger ${describe(happened)} failed: ${error}`)
    })
  return queue
}
