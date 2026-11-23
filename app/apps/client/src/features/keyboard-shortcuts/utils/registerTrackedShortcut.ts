import {
  register,
  type ShortcutHandler,
} from '@tauri-apps/plugin-global-shortcut'

import { trackEvent } from '~/features/analytics'
import {
  getCurrentFeature,
  getCurrentRoute,
} from '~/features/analytics/utils/currentRoute'

/**
 * Registers a key held by the OS (it works from any program); each press is
 * also sent as `shortcut_used` with scope `system`, like the in-app keys.
 */
export function registerTrackedShortcut(
  shortcut: string,
  handler: ShortcutHandler,
): Promise<void> {
  return register(shortcut, (event) => {
    if (event.state === 'Pressed') {
      trackEvent('shortcut_used', {
        shortcut,
        scope: 'system',
        feature: getCurrentFeature(),
        route: getCurrentRoute(),
      })
    }
    handler(event)
  })
}
