import { useMemo } from 'react'

import { useShortcutPermissionCheck } from '~/features/keyboard-shortcuts/hooks/useShortcutPermissionCheck'
import { useSidebarConfig } from './useSidebarConfig'
import { BUILTIN_ITEMS } from '../constants'
import { getCustomPagePermission } from '../service/sidebarConfig'
import type { BuiltInMenuItem, CustomPageMenuItem } from '../types'

export interface SidebarShortcut {
  shortcut: string
  itemId: string
  route: string
  focusSearchOnNavigate: boolean
  displayName: string
}

/**
 * Returns all configured shortcuts for sidebar items.
 * Used by GlobalAppShortcutManager to register sidebar navigation shortcuts.
 *
 * Emits separate entries for switch shortcuts (focusSearchOnNavigate=false)
 * and focus-search shortcuts (focusSearchOnNavigate=true). Pages the user may
 * not view are left out, the same as the sidebar hides them.
 */
export function useSidebarItemShortcuts(): SidebarShortcut[] {
  const { config, isLoading } = useSidebarConfig()
  const canUse = useShortcutPermissionCheck()

  return useMemo(() => {
    if (isLoading || !config) {
      return []
    }

    const shortcuts: SidebarShortcut[] = []

    for (const item of config.items) {
      if (!item.settings) continue

      // Get route and display name based on item type
      let route: string
      let displayName: string

      if (item.type === 'builtin') {
        const builtinItem = item as BuiltInMenuItem
        const definition = BUILTIN_ITEMS[builtinItem.builtinId]
        if (!definition || !canUse(definition.permission)) continue

        route = definition.to
        displayName = builtinItem.builtinId
      } else {
        const customItem = item as CustomPageMenuItem
        if (!canUse(getCustomPagePermission(customItem.id))) continue
        route = `/custom-page/${customItem.id}`
        displayName = customItem.title
      }

      // Add switch shortcuts (no focus search)
      if (item.settings.shortcuts?.length) {
        for (const shortcut of item.settings.shortcuts) {
          if (!shortcut) continue

          // If using legacy model (no focusSearchShortcuts), use focusSearchOnNavigate
          const useLegacy = !item.settings.focusSearchShortcuts
          shortcuts.push({
            shortcut,
            itemId: item.id,
            route,
            focusSearchOnNavigate: useLegacy
              ? (item.settings.focusSearchOnNavigate ?? false)
              : false,
            displayName,
          })
        }
      }

      // Add focus-search shortcuts (always focus search)
      if (item.settings.focusSearchShortcuts?.length) {
        for (const shortcut of item.settings.focusSearchShortcuts) {
          if (!shortcut) continue

          shortcuts.push({
            shortcut,
            itemId: item.id,
            route,
            focusSearchOnNavigate: true,
            displayName,
          })
        }
      }
    }

    return shortcuts
  }, [config, isLoading, canUse])
}
