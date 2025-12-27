import { createContext, useContext, useEffect, useState } from 'react'

import { getCurrentUser } from '../features/users/service'
import type { CurrentUser, Permission } from '../features/users/types'
import {
  ALL_PERMISSIONS,
  isCustomPagePermission,
} from '../features/users/types'

interface PermissionsContextType {
  permissions: Permission[]
  hasPermission: (permission: Permission | string) => boolean
  hasAnyPermission: (permissions: (Permission | string)[]) => boolean
  hasAllPermissions: (permissions: (Permission | string)[]) => boolean
  isAdmin: boolean
  isApp: boolean
  isAuthenticated: boolean
  isLoading: boolean
  isConnectionError: boolean
  userId: number | null
  userName: string | null
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined,
)

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnrefused')
    )
  }
  return false
}

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnectionError, setIsConnectionError] = useState(false)

  const loadPermissions = async () => {
    try {
      const user = await getCurrentUser()
      setCurrentUser(user)
      setIsConnectionError(false)
    } catch (error) {
      setCurrentUser(null)
      setIsConnectionError(isNetworkError(error))
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

  const hasPermission = (permission: Permission | string): boolean => {
    if (isApp) return true
    // For dynamic custom page permissions, check if user has this specific permission
    if (isCustomPagePermission(permission)) {
      return effectivePermissions.includes(permission as Permission)
    }
    return effectivePermissions.includes(permission as Permission)
  }

  const hasAnyPermission = (perms: (Permission | string)[]): boolean => {
    if (isApp) return true
    return perms.some((p) => hasPermission(p))
  }

  const hasAllPermissions = (perms: (Permission | string)[]): boolean => {
    if (isApp) return true
    return perms.every((p) => hasPermission(p))
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
    isConnectionError,
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
