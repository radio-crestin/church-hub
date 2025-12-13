import { createContext, useContext, useEffect, useState } from 'react'

import { getCurrentUser } from '../features/users/service'
import type { CurrentUser, Permission } from '../features/users/types'
import { ALL_PERMISSIONS } from '../features/users/types'

interface PermissionsContextType {
  permissions: Permission[]
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  isAdmin: boolean
  isApp: boolean
  isAuthenticated: boolean
  isLoading: boolean
  userId: number | null
  userName: string | null
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined,
)

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadPermissions = async () => {
    try {
      const user = await getCurrentUser()
      setCurrentUser(user)
    } catch {
      setCurrentUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions()
  }, [])

  const permissions = currentUser?.permissions ?? []
  const isApp = currentUser?.isApp ?? false

  // App auth has all permissions
  const effectivePermissions = isApp ? ALL_PERMISSIONS : permissions

  const hasPermission = (permission: Permission): boolean => {
    if (isApp) return true
    return effectivePermissions.includes(permission)
  }

  const hasAnyPermission = (perms: Permission[]): boolean => {
    if (isApp) return true
    return perms.some((p) => effectivePermissions.includes(p))
  }

  const hasAllPermissions = (perms: Permission[]): boolean => {
    if (isApp) return true
    return perms.every((p) => effectivePermissions.includes(p))
  }

  const isAdmin =
    isApp ||
    ALL_PERMISSIONS.every((p) => effectivePermissions.includes(p as Permission))

  const value: PermissionsContextType = {
    permissions: effectivePermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isApp,
    isAuthenticated: currentUser !== null,
    isLoading,
    userId: currentUser?.id ?? null,
    userName: currentUser?.name ?? null,
    refresh: loadPermissions,
  }

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }
  return context
}
