import type { ScheduleAutomationSettings } from './types'

/** The automation columns of a `schedules` row, as the API returns them. */
export function toScheduleAutomation(row: {
  autoplaySeconds: number | null
  loop: boolean
  musicVolume: number | null
  startOnAppStart: boolean
}): ScheduleAutomationSettings {
  return {
    autoplaySeconds: row.autoplaySeconds,
    loop: row.loop,
    musicVolume: row.musicVolume,
    startOnAppStart: row.startOnAppStart,
  }
}
