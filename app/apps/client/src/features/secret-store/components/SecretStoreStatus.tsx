import { useTranslation } from 'react-i18next'

import { useSecretStoreStatus } from '../hooks'
import type { SecretStoreStatus as Status } from '../service'

const KEPT_IN = {
  keychain: 'keychain',
  'credential-manager': 'credentialManager',
  'secret-service': 'secretService',
  file: 'file',
} as const

const whereKept = (status: Status) =>
  status.locked || !status.keptIn
    ? 'locked'
    : `keptIn.${KEPT_IN[status.keptIn]}`

/**
 * Where the key sealing this computer's saved passwords, API keys and
 * sign-ins is kept.
 */
export function SecretStoreStatus() {
  const { t } = useTranslation('settings')
  const { status } = useSecretStoreStatus()
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
    </div>
  )
}
