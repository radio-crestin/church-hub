import type { ReactNode } from 'react'

import { isMobile } from '~/config'
import { usePermissions } from '~/provider/permissions-provider'
import { clearApiUrl } from '~/service/api-url'
import { ApiUrlSetup } from './ApiUrlSetup'

interface MobileConnectionGuardProps {
  children: ReactNode
}

/**
 * Guards the app on mobile devices - shows API URL setup when:
 * - Connection to server fails
 * - User is not authenticated (access denied)
 *
 * This allows users to reconfigure the server URL and token when they can't connect.
 */
export function MobileConnectionGuard({
  children,
}: MobileConnectionGuardProps) {
  const { isLoading, isConnectionError, isAuthenticated } = usePermissions()

  // Only apply this guard on mobile
  if (!isMobile()) {
    return <>{children}</>
  }

  // Wait for initial auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  // Show API URL setup when connection fails or user is not authenticated
  if (isConnectionError || !isAuthenticated) {
    return (
      <ApiUrlSetup
        onComplete={() => {
          // Clear the old URL first to ensure fresh start
          clearApiUrl()
          // Reload to reinitialize with the new API URL
          window.location.reload()
        }}
      />
    )
  }

  return <>{children}</>
}
