import { BUILTIN_ITEMS } from '~/features/sidebar-config/constants'
import type { GlobalShortcutActionId } from '../types'

/** What the server asks to move or show the projection. */
const PRESENTATION_CONTROL_PERMISSION = 'control_room.control'

/**
 * The permission an action's shortcut needs: the same the user needs to do it
 * by hand. Live stream keys belong to the Livestream page.
 */
export function shortcutActionPermission(
  actionId: GlobalShortcutActionId,
): string {
  if (actionId === 'startLive' || actionId === 'stopLive') {
    return BUILTIN_ITEMS.livestream.permission
  }
  return PRESENTATION_CONTROL_PERMISSION
}
