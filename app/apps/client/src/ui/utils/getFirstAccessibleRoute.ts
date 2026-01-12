import { BUILTIN_ITEMS } from '../../features/sidebar-config/constants'
import { getCustomPagePermission } from '../../features/sidebar-config/service/sidebarConfig'
import type { SidebarConfiguration } from '../../features/sidebar-config/types'
import type { Permission } from '../../features/users/types'

/**
 * Finds the first accessible route based on user permissions and sidebar configuration
 * Returns null if no accessible routes are found
 */
export function getFirstAccessibleRoute(
  sidebarConfig: SidebarConfiguration | undefined,
  hasPermission: (permission: Permission | string) => boolean,
  currentPath?: string,
): string | null {
  if (!sidebarConfig) {
    return null
  }

  // Sort items by order
  const sortedItems = [...sidebarConfig.items]
    .filter((item) => item.isVisible)
    .sort((a, b) => a.order - b.order)

  for (const item of sortedItems) {
    let route: string
    let permission: Permission | string

    if (item.type === 'builtin') {
      const definition = BUILTIN_ITEMS[item.builtinId]
      if (!definition) continue

      route = definition.to
      permission = definition.permission
    } else {
      // Custom page
      route = `/custom-page/${item.id}`
      permission = getCustomPagePermission(item.id)
    }

    // Skip the current path to avoid redirect loops
    if (currentPath && route === currentPath) {
      continue
    }

    if (hasPermission(permission)) {
      return route
    }
  }

  // Also check settings as it's always at the bottom
  if (hasPermission('settings.view') && currentPath !== '/settings') {
    return '/settings'
  }

  return null
}
