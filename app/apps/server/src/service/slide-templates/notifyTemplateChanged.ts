import { getTemplateUsage } from './getTemplateUsage'
import {
  broadcastScreenConfigUpdated,
  broadcastSlideTemplateUpdated,
} from '../../websocket'

/**
 * Tells every client a template changed, and every screen that draws with it
 * (as its own or for an OBS scene) that its design did.
 */
export function notifyTemplateChanged(templateId: number): void {
  broadcastSlideTemplateUpdated(templateId)
  const usage = getTemplateUsage(templateId)
  const screenIds = new Set([
    ...usage.screens.map((screen) => screen.id),
    ...usage.sceneScreens.map((screen) => screen.id),
  ])
  for (const screenId of screenIds) broadcastScreenConfigUpdated(screenId)
}
