import {
  useResolvedSidebarItems,
  useSidebarConfig,
} from '../../features/sidebar-config'
import type { Permission } from '../../features/users/types'
import { usePermissions } from '../../provider/permissions-provider'

/**
 * The pages the sidebar lists, in the operator's order, that this user may
 * open. Settings, kiosk and feedback are left out: the sidebar draws them as
 * their own buttons at its foot.
 */
export function useSidebarMenuItems() {
  const { hasPermission } = usePermissions()
  const { config } = useSidebarConfig()
  const resolvedItems = useResolvedSidebarItems(config?.items)

  return resolvedItems.filter((item) => {
    if (
      item.id === 'settings' ||
      item.id === 'kiosk' ||
      item.id === 'feedback'
    ) {
      return false
    }
    // Custom pages: check dynamic permission
    if (item.isCustom) {
      return hasPermission(item.permission as Permission)
    }
    // Built-in items: check their permission
    return item.permission ? hasPermission(item.permission) : true
  })
}
