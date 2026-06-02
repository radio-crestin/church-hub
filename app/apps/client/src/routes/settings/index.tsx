import { createFileRoute, Navigate } from '@tanstack/react-router'

import { isLocalhost, isMobile } from '~/config'
import { getFirstVisibleLeaf } from '~/features/settings'
import { usePermissions } from '~/provider/permissions-provider'

export const Route = createFileRoute('/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  const { hasPermission, isLoading } = usePermissions()

  // On mobile, the index route IS the master category list (rendered by
  // SettingsLayout); the content pane shows nothing here.
  if (isMobile()) return null

  // Desktop: jump straight to the first category the user can access.
  if (isLoading) return null
  return (
    <Navigate
      to={getFirstVisibleLeaf({
        hasPermission,
        isMobile: isMobile(),
        isLocalhost: isLocalhost(),
      })}
      replace
    />
  )
}
