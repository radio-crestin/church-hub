import type { ScheduleAutomationSettings } from './types'

/** The automation columns of a `schedules` row, as the API returns them. */
export function toScheduleAutomation(row: {
  autoplaySeconds: number | null
  autoplayByText: boolean
  loop: boolean
  musicVolume: number | null
  startOnAppStart: boolean
}): ScheduleAutomationSettings {
  return {
    autoplaySeconds: row.autoplaySeconds,
    autoplayByText: row.autoplayByText,
    loop: row.loop,
    musicVolume: row.musicVolume,
    startOnAppStart: row.startOnAppStart,
  }
}
