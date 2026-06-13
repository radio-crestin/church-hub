import { useNavigate } from '@tanstack/react-router'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { useToast } from '~/ui/toast'
import {
  type UseSongDiscoverySyncResult,
  useSongDiscoverySync,
} from '../hooks/useSongDiscoverySync'

/** Signature already toasted for — one toast per distinct catalog change, ever. */
const TOASTED_SIGNATURE_KEY = 'song-discovery-toasted-signature'

/** How long the "new songs" toast stays up (the badge is the lingering reminder). */
const TOAST_DURATION_MS = 15_000

const SongDiscoveryContext = createContext<UseSongDiscoverySyncResult | null>(
  null,
)

/**
 * App-level provider that runs the background catalog sync ONCE (not per
 * consumer), fires a one-time toast when a fresh batch of new songs appears,
 * and exposes the badge count + dismiss to the sidebar and other consumers.
 *
 * Gated on `songs.create` — users who can't import shouldn't be pinged. Must be
 * mounted inside the Router, ToastProvider and PermissionsProvider.
 */
export function SongDiscoveryProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  const canImport = hasPermission('songs.create')
  const sync = useSongDiscoverySync(canImport)

  const { hasUnacknowledgedNew, newCount } = sync

  // Toast exactly once per distinct catalog signature (persisted across
  // sessions) so the user isn't re-pinged for songs they've already seen.
  const lastToastedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!hasUnacknowledgedNew || newCount <= 0) return

    const currentSignature = localStorage.getItem('song-discovery-signature')
    if (!currentSignature) return

    const alreadyToasted =
      localStorage.getItem(TOASTED_SIGNATURE_KEY) === currentSignature
    if (alreadyToasted || lastToastedRef.current === currentSignature) return

    lastToastedRef.current = currentSignature
    localStorage.setItem(TOASTED_SIGNATURE_KEY, currentSignature)

    showToast(t('toast.newSongs', { count: newCount }), 'info', {
      duration: TOAST_DURATION_MS,
      action: {
        label: t('toast.view'),
        onClick: () => navigate({ to: '/songs/discover' }),
      },
    })
  }, [hasUnacknowledgedNew, newCount, showToast, navigate, t])

  return (
    <SongDiscoveryContext.Provider value={sync}>
      {children}
    </SongDiscoveryContext.Provider>
  )
}

/**
 * Consumes the background discovery state (badge count, dismiss, enable
 * toggle). Returns a safe no-op shape when used outside the provider (e.g. on
 * screen-only windows that don't mount it).
 */
export function useSongDiscovery(): UseSongDiscoverySyncResult {
  const ctx = useContext(SongDiscoveryContext)
  if (ctx) return ctx
  return {
    badgeCount: 0,
    enabled: false,
    setEnabled: () => {},
    isChecking: false,
    dismiss: () => {},
    checkNow: async () => {},
    hasUnacknowledgedNew: false,
    newCount: 0,
  }
}
