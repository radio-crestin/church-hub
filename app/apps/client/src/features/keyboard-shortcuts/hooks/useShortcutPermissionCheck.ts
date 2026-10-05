import { useMemo } from 'react'

import { usePermissions } from '~/provider/permissions-provider'

export type ShortcutPermissionCheck = (permission?: string) => boolean

/**
 * Whether the signed-in user holds a permission, as a function that stays the
 * same until their permissions change — so lists of shortcuts built from it
 * are not rebuilt (and re-registered OS-wide) on every render. A shortcut
 * leading to something the user may not see must not run.
 */
export function useShortcutPermissionCheck(): ShortcutPermissionCheck {
  const { permissions, isApp } = usePermissions()
  const permissionsKey = permissions.join('\n')

  return useMemo(() => {
    const granted = new Set(permissionsKey.split('\n'))
    return (permission) => !permission || isApp || granted.has(permission)
  }, [permissionsKey, isApp])
}
