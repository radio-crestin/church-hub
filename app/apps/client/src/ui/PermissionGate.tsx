import type { ReactNode } from 'react'

import type { Permission } from '../features/users/types'
import { usePermissions } from '../provider/permissions-provider'

interface PermissionGateProps {
  /** Single permission required */
  permission?: Permission
  /** Any of these permissions (OR logic) */
  anyOf?: Permission[]
  /** All of these permissions required (AND logic) */
  allOf?: Permission[]
  /** Content to show when permission is granted */
  children: ReactNode
  /** Content to show when permission is denied (optional) */
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on user permissions.
 *
 * @example
 * // Single permission
 * <PermissionGate permission="songs.create">
 *   <CreateSongButton />
 * </PermissionGate>
 *
 * @example
 * // Any of multiple permissions
 * <PermissionGate anyOf={['songs.edit', 'songs.delete']}>
 *   <EditOrDeleteButtons />
 * </PermissionGate>
 *
 * @example
 * // All permissions required
 * <PermissionGate allOf={['queue.add', 'queue.remove']}>
 *   <QueueManagement />
 * </PermissionGate>
 *
 * @example
 * // With fallback
 * <PermissionGate permission="settings.edit" fallback={<ReadOnlySettings />}>
 *   <EditableSettings />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } =
    usePermissions()

  // Don't render anything while loading
  if (isLoading) {
    return null
  }

  let hasAccess = true

  if (permission) {
    hasAccess = hasPermission(permission)
  } else if (anyOf) {
    hasAccess = hasAnyPermission(anyOf)
  } else if (allOf) {
    hasAccess = hasAllPermissions(allOf)
  }

  return <>{hasAccess ? children : fallback}</>
}

/**
 * Hook to check permissions imperatively
 */
export function useHasPermission(permission: Permission): boolean {
  const { hasPermission, isLoading } = usePermissions()
  if (isLoading) return false
  return hasPermission(permission)
}

/**
 * Hook to check if user has any of the permissions
 */
export function useHasAnyPermission(permissions: Permission[]): boolean {
  const { hasAnyPermission, isLoading } = usePermissions()
  if (isLoading) return false
  return hasAnyPermission(permissions)
}
