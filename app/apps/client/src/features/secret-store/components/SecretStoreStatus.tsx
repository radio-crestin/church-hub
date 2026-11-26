import { useTranslation } from 'react-i18next'

import { useSecretStoreStatus } from '../hooks'
import type { SecretFeature, SecretStoreStatus as Status } from '../service'

const KEPT_IN = {
  keychain: 'keychain',
  'credential-manager': 'credentialManager',
  'secret-service': 'secretService',
  file: 'file',
} as const

const FEATURE = {
  youtube: 'youtube',
  'google-drive': 'googleDrive',
  'cloud-sync': 'cloudSync',
  'listener-link': 'listenerLink',
  'remote-access': 'remoteAccess',
  'cloud-backup': 'cloudBackup',
  obs: 'obs',
  'song-sources': 'songSources',
  'ai-search': 'aiSearch',
  'live-translation': 'liveTranslation',
  users: 'users',
} as const satisfies Record<SecretFeature, string>

const whereKept = (status: Status) =>
  status.locked || !status.keptIn
    ? 'locked'
    : `keptIn.${KEPT_IN[status.keptIn]}`

/**
 * Where the key sealing this computer's saved passwords, API keys and
 * sign-ins is kept, and, after a restore from another computer, what to set
 * up again.
 */
export function SecretStoreStatus() {
  const { t } = useTranslation('settings')
  const { status, dismissReset } = useSecretStoreStatus()
  if (!status) return null

  return (
    <div className="space-y-2" data-testid="secret-store-status">
      <p
        className={`text-sm ${status.locked ? 'text-fg' : 'text-fg-label'}`}
        data-kept-in={status.keptIn ?? 'locked'}
      >
        {t(`sections.secretStore.${whereKept(status)}`)}
      </p>
      <p className="text-xs text-fg-hint">
        {t('sections.secretStore.otherComputer')}
      </p>
      {status.resetFeatures.length > 0 && (
        <div
          className="mt-3 rounded-xl border border-line p-3"
          data-testid="secret-store-reset"
        >
          <p className="text-sm font-medium text-fg">
            {t('sections.secretStore.reset.title')}
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-fg-label">
            {status.resetFeatures.map((feature) => (
              <li key={feature} data-feature={feature}>
                {t(`sections.secretStore.reset.features.${FEATURE[feature]}`)}
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
      )}
    </div>
  )
}
