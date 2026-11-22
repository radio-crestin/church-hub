import type { ScheduleAutomationSettings } from './types'

const MIN_AUTOPLAY_SECONDS = 1
const MAX_AUTOPLAY_SECONDS = 3600

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * The `schedules` columns to write for the automation settings given: only
 * those present, each brought into its range.
 */
export function automationColumns(
  automation: Partial<ScheduleAutomationSettings> | undefined,
): Partial<ScheduleAutomationSettings> {
  if (!automation) return {}
  const columns: Partial<ScheduleAutomationSettings> = {}
  if (automation.autoplaySeconds !== undefined) {
    columns.autoplaySeconds =
      automation.autoplaySeconds === null
        ? null
        : clamp(
            automation.autoplaySeconds,
            MIN_AUTOPLAY_SECONDS,
            MAX_AUTOPLAY_SECONDS,
          )
  }
  if (automation.loop !== undefined) columns.loop = !!automation.loop
  if (automation.musicVolume !== undefined) {
    columns.musicVolume =
      automation.musicVolume === null
        ? null
        : clamp(automation.musicVolume, 0, 100)
  }
  if (automation.startOnAppStart !== undefined) {
    columns.startOnAppStart = !!automation.startOnAppStart
  }
  return columns
}
