import type { ScheduleAutomationSettings } from '../types'

/** Whether any automation setting of a presentation is turned on. */
export function isAutomationOn(
  automation: ScheduleAutomationSettings,
): boolean {
  return (
    automation.autoplaySeconds != null ||
    automation.loop ||
    automation.musicVolume != null ||
    automation.startOnAppStart ||
    automation.startTrigger !== null ||
    automation.stopTrigger !== null
  )
}
