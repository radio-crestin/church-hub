import { clampSeconds } from './clampSeconds'
import { toAutomationTrigger } from './toAutomationTrigger'
import type { ScheduleAutomationSettings } from './types'

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
        : clampSeconds(automation.autoplaySeconds)
  }
  if (automation.autoplayByText !== undefined) {
    columns.autoplayByText = !!automation.autoplayByText
  }
  if (automation.loop !== undefined) columns.loop = !!automation.loop
  if (automation.musicVolume !== undefined) {
    columns.musicVolume =
      automation.musicVolume === null
        ? null
        : Math.min(100, Math.max(0, Math.round(automation.musicVolume)))
  }
  if (automation.startOnAppStart !== undefined) {
    columns.startOnAppStart = !!automation.startOnAppStart
  }
  if (automation.startTrigger !== undefined) {
    columns.startTrigger = toAutomationTrigger(automation.startTrigger)
  }
  if (automation.stopTrigger !== undefined) {
    columns.stopTrigger = toAutomationTrigger(automation.stopTrigger)
  }
  return columns
}
