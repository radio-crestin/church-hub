import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { isLocalhost, isMobile } from '~/config'
import { getFirstVisibleLeaf } from '~/features/settings'
import { usePermissions } from '~/provider/permissions-provider'

export const Route = createFileRoute('/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  const { hasPermission, isLoading } = usePermissions()
  const navigate = useNavigate()

  // First category the user can access. `getFirstVisibleLeaf` is deterministic
  // and returns a stable string (Appearance is always first + always visible),
  // so this drives a one-shot redirect rather than a per-render <Navigate> —
  // the latter re-issued navigation on every re-render of this index route and
  // tripped React's "Maximum update depth exceeded" guard during the
  // /settings → /settings/appearance transition.
  const target = getFirstVisibleLeaf({
    hasPermission,
    isMobile: isMobile(),
    isLocalhost: isLocalhost(),
  })

  useEffect(() => {
    // On mobile the index route IS the master category list (rendered by
    // SettingsLayout); don't redirect. Desktop jumps to the first category once
    // permissions have loaded.
    if (isMobile() || isLoading) return
    navigate({ to: target, replace: true })
  }, [isLoading, navigate, target])

  return null
}
