import { useMemo } from 'react'

import { useShortcutPermissionCheck } from '~/features/keyboard-shortcuts/hooks/useShortcutPermissionCheck'
import { useSidebarConfig } from './useSidebarConfig'
import { BUILTIN_ITEMS } from '../constants'
import {
  type BuiltInMenuItem,
  type BuiltInMenuItemId,
  PAGE_SHORTCUT_ACTIONS,
  type PageShortcutAction,
} from '../types'

export interface PageShortcut {
  shortcut: string
  pageId: BuiltInMenuItemId
  /** The route the page lives under; the shortcut fires only there. */
  route: string
  action: PageShortcutAction
}

/**
 * Every presentation shortcut a built-in page bound to itself. The same key
 * may appear for several pages — that is the point: which one it means is
 * decided by the page that is open when it is pressed. MIDI bindings are
 * left out: those are dispatched by the server, which does not know which
 * page is showing. Pages the user may not view are left out.
 */
export function usePageShortcuts(): PageShortcut[] {
  const { config, isLoading } = useSidebarConfig()
  const canUse = useShortcutPermissionCheck()

  return useMemo(() => {
    if (isLoading || !config) return []

    const shortcuts: PageShortcut[] = []
    for (const item of config.items) {
      if (item.type !== 'builtin' || !item.settings?.pageShortcuts) continue
      const { builtinId } = item as BuiltInMenuItem
      const definition = BUILTIN_ITEMS[builtinId]
      if (!definition || !canUse(definition.permission)) continue

      for (const action of PAGE_SHORTCUT_ACTIONS) {
        for (const shortcut of item.settings.pageShortcuts[action] ?? []) {
          if (!shortcut || shortcut.startsWith('midi:')) continue
          shortcuts.push({
            shortcut,
            pageId: builtinId,
            route: definition.to,
            action,
          })
        }
      }
    }
    return shortcuts
  }, [config, isLoading, canUse])
}
