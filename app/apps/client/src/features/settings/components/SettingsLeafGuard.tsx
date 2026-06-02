import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { isLocalhost, isMobile } from '~/config'
import { usePermissions } from '~/provider/permissions-provider'
import { findItemById, getFirstVisibleLeaf, isItemVisible } from '../registry'

interface SettingsLeafGuardProps {
  /** Registry item id whose visibility predicate gates this route. */
  itemId: string
  children: ReactNode
}

/**
 * Guards direct-URL access to a settings leaf using the registry's own
 * visibility predicate, so the URL gate can never drift from the sidebar gate.
 * Redirects to the user's first accessible leaf instead of showing an error.
 */
export function SettingsLeafGuard({
  itemId,
  children,
}: SettingsLeafGuardProps) {
  const { hasPermission } = usePermissions()
  const ctx = {
    hasPermission,
    isMobile: isMobile(),
    isLocalhost: isLocalhost(),
  }

  const item = findItemById(itemId)
  if (item && !isItemVisible(item, ctx)) {
    return <Navigate to={getFirstVisibleLeaf(ctx)} replace />
  }

  return <>{children}</>
}
