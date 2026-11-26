import { AUTOMATION_TRIGGER_EVENTS, type AutomationTrigger } from './types'

/**
 * A trigger as given to the API, checked: an unknown event, or a scene
 * trigger with no scene, is refused rather than stored to never fire.
 */
export function toAutomationTrigger(
  trigger: AutomationTrigger | null,
): AutomationTrigger | null {
  if (trigger === null) return null
  if (!AUTOMATION_TRIGGER_EVENTS.includes(trigger.event)) {
    throw new Error(`Unknown trigger event: ${trigger.event}`)
  }
  if (trigger.event !== 'scene_selected') {
    return { event: trigger.event, sceneName: null }
  }
  const sceneName = trigger.sceneName?.trim()
  if (!sceneName) throw new Error('A scene trigger needs a scene')
  return { event: trigger.event, sceneName }
}
