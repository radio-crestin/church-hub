import type { ScheduleStep } from './buildScheduleSteps'
import { stepSeconds } from './stepSeconds'
import { getBackgroundVideoSeconds } from '../background-media'
import type { VideoItemConfig } from '../schedule-items'
import type { ScheduleAutomationSettings } from '../schedules/types'

/**
 * How long a step stays up while it runs (`stepSeconds`); a video stays up
 * until it ends, unless its item has a time of its own or it loops (then it
 * plays for the step's time, again and again).
 */
export async function runStepSeconds(
  step: ScheduleStep,
  automation: Pick<ScheduleAutomationSettings, 'autoplayByText'> & {
    autoplaySeconds: number
  },
): Promise<number> {
  const video = step.type === 'video' ? step.item.video : null
  const loops = (step.item.itemConfig as VideoItemConfig | null)?.loop
  if (video && !loops && step.item.advanceSeconds == null) {
    const length =
      video.seconds ?? (await getBackgroundVideoSeconds(video.mediaId))
    if (length) return Math.ceil(length)
  }
  return stepSeconds(step, automation)
}
