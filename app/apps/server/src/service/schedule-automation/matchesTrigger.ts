import type { AutomationTrigger, AutomationTriggerEvent } from '../schedules/types'

/** Something that happened in OBS, as the triggers see it. */
export interface AutomationEvent {
  event: AutomationTriggerEvent
  /** The scene selected (`scene_selected` only). */
  sceneName?: string
}

/** Whether a presentation's trigger fires on what happened. */
export function matchesTrigger(
  trigger: AutomationTrigger | null,
  happened: AutomationEvent,
): boolean {
  if (!trigger || trigger.event !== happened.event) return false
  return (
    trigger.event !== 'scene_selected' ||
    trigger.sceneName === happened.sceneName
  )
}
