import { shortcutActionPermission } from './shortcutActionPermission'
import type { GlobalShortcutActionId, GlobalShortcutsConfig } from '../types'

/**
 * The shortcuts config with every action the user may not use switched off,
 * so its keys are never held and stay with whatever program is in front.
 */
export function permittedShortcutsConfig(
  config: GlobalShortcutsConfig,
  canUse: (permission?: string) => boolean,
): GlobalShortcutsConfig {
  const actions = { ...config.actions }
  for (const actionId of Object.keys(actions) as GlobalShortcutActionId[]) {
    if (!canUse(shortcutActionPermission(actionId))) {
      actions[actionId] = { ...actions[actionId], enabled: false }
    }
  }
  return { ...config, actions }
}
