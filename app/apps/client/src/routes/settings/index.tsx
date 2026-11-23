import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { isLocalhost, isMobile } from '~/config'
import {
  getFirstVisibleLeaf,
  getLastSettingsSection,
  isVisibleLeafPath,
} from '~/features/settings'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { usePermissions } from '~/provider/permissions-provider'

export const Route = createFileRoute('/settings/')({
  component: SettingsIndex,
})

function SettingsIndex() {
  const { hasPermission, isLoading } = usePermissions()
  const navigate = useNavigate()
  // Side by side (md and up) the list sits next to a section, so one opens;
  // narrower, the index is the list itself, in a phone's browser too.
  const isWide = useMediaQuery('(min-width: 768px)')

  // Reopen the section the operator last had open (if it's still visible),
  // otherwise fall back to the first category the user can access.
  // `getFirstVisibleLeaf` is deterministic and returns a stable string
  // (Appearance is always first + always visible), so this drives a one-shot
  // redirect rather than a per-render <Navigate> — the latter re-issued
  // navigation on every re-render of this index route and tripped React's
  // "Maximum update depth exceeded" guard during the
  // /settings → /settings/appearance transition.
  const ctx = {
    hasPermission,
    isMobile: isMobile(),
    isLocalhost: isLocalhost(),
  }
  const remembered = getLastSettingsSection()
  const target =
    remembered && isVisibleLeafPath(remembered, ctx)
      ? remembered
      : getFirstVisibleLeaf(ctx)

  useEffect(() => {
    if (!isWide || isLoading) return
    navigate({ to: target, replace: true })
  }, [isWide, isLoading, navigate, target])

  return null
}
