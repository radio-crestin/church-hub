import { getScreenById } from './screens'
import { broadcastScreenConfigUpdated } from '../../websocket'
import { notifyTemplateChanged } from '../slide-templates/notifyTemplateChanged'

/**
 * A screen's design was saved into its template: every screen drawing with
 * that template redraws, not only this one.
 */
export function notifyScreenDesignChanged(screenId: number): void {
  broadcastScreenConfigUpdated(screenId)
  const screen = getScreenById(screenId)
  if (screen) notifyTemplateChanged(screen.templateId)
}
