import { useMemo } from 'react'

import { useSidebarConfig } from './useSidebarConfig'
import { BUILTIN_ITEMS } from '../constants'
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
 */
export function useSidebarItemShortcuts(): SidebarShortcut[] {
  const { config, isLoading } = useSidebarConfig()

  return useMemo(() => {
    if (isLoading || !config) {
      return []
    }

    const shortcuts: SidebarShortcut[] = []

    for (const item of config.items) {
      // Skip items without settings or shortcuts
      if (!item.settings?.shortcuts?.length) {
        continue
      }

      // Get route and display name based on item type
      let route: string
      let displayName: string

      if (item.type === 'builtin') {
        const builtinItem = item as BuiltInMenuItem
        const definition = BUILTIN_ITEMS[builtinItem.builtinId]
        if (!definition) continue

        route = definition.to
        // We'll use the builtinId as display name for conflict messages
        // The actual translation happens in the UI
        displayName = builtinItem.builtinId
      } else {
        const customItem = item as CustomPageMenuItem
        // Custom pages use custom-page route (matches useResolvedSidebarItems)
        route = `/custom-page/${customItem.id}`
        displayName = customItem.title
      }

      // Add all shortcuts for this item
      for (const shortcut of item.settings.shortcuts) {
        if (!shortcut) continue

        shortcuts.push({
          shortcut,
          itemId: item.id,
          route,
          focusSearchOnNavigate: item.settings.focusSearchOnNavigate ?? false,
          displayName,
        })
      }
    }

    return shortcuts
  }, [config, isLoading])
}
