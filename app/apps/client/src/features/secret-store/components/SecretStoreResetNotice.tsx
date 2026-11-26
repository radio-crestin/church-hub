import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSecretStoreStatus } from '../hooks'
import type { SecretFeature } from '../service'

/** Each feature's label and the page where it is set up again. */
const FEATURES = {
  youtube: { label: 'youtube', to: '/livestream/youtube' },
  'google-drive': { label: 'googleDrive', to: '/settings/backup' },
  'cloud-backup': { label: 'cloudBackup', to: '/settings/backup' },
  'cloud-sync': { label: 'cloudSync', to: '/settings/backup' },
  'listener-link': { label: 'listenerLink', to: '/live-translation' },
  'live-translation': { label: 'liveTranslation', to: '/live-translation' },
  'remote-access': { label: 'remoteAccess', to: '/settings/phones' },
  obs: { label: 'obs', to: '/livestream/obs' },
  'song-sources': { label: 'songSources', to: '/settings/songs' },
  'ai-search': { label: 'aiSearch', to: '/settings/songs' },
  users: { label: 'users', to: '/settings/users' },
} as const satisfies Record<SecretFeature, { label: string; to: string }>

/**
 * After a backup from another computer was restored here: what to set up
 * again, one tap each to its page, until dismissed. Its saved passwords and
 * keys stayed on that computer.
 */
export function SecretStoreResetNotice() {
  const { t } = useTranslation('settings')
  const { status, dismissReset } = useSecretStoreStatus()
  if (!status?.resetFeatures.length) return null

  return (
    <div
      className="rounded-xl border border-line bg-panel p-4"
      data-testid="secret-store-reset"
    >
      <p className="text-sm font-medium text-fg">
        {t('sections.secretStore.reset.title')}
      </p>
      <ul className="mt-2 space-y-1">
        {status.resetFeatures.map((feature) => (
          <li key={feature}>
            <Link
              to={FEATURES[feature].to}
              data-feature={feature}
              className="flex h-10 items-center justify-between gap-3 rounded-lg px-3 text-sm text-fg-body transition-colors hover:bg-hover"
            >
              {t(
                `sections.secretStore.reset.features.${FEATURES[feature].label}`,
              )}
              <ChevronRight
                className="h-4 w-4 flex-shrink-0 text-fg-label"
                strokeWidth={1.5}
              />
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => dismissReset()}
        className="mt-3 h-8 rounded-lg bg-field px-3 text-sm font-medium text-fg transition-colors hover:bg-hover"
      >
        {t('sections.secretStore.reset.dismiss')}
      </button>
    </div>
  )
}
