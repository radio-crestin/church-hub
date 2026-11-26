import type { AutomationTrigger, ScheduleAutomationSettings } from './types'

/** The automation columns of a `schedules` row, as the API returns them. */
export function toScheduleAutomation(row: {
  autoplaySeconds: number | null
  autoplayByText: boolean
  loop: boolean
  musicVolume: number | null
  startOnAppStart: boolean
  startTrigger: AutomationTrigger | null
  stopTrigger: AutomationTrigger | null
}): ScheduleAutomationSettings {
  return {
    autoplaySeconds: row.autoplaySeconds,
    autoplayByText: row.autoplayByText,
    loop: row.loop,
    musicVolume: row.musicVolume,
    startOnAppStart: row.startOnAppStart,
    startTrigger: row.startTrigger,
    stopTrigger: row.stopTrigger,
  }
}
