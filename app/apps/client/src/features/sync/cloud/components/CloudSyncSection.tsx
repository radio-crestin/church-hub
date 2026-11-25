import { Loader2 } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { CloudSyncOff } from './CloudSyncOff'
import { CloudSyncOn } from './CloudSyncOn'
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { useOwnerSignIn } from '../hooks'
import type { OwnerSignInIntent } from '../service'

/**
 * Cloud sync settings (T-172): turn it on with Google or as a guest, claim
 * a guest church, recover one on this PC, and the owner's tools.
 */
export function CloudSyncSection() {
  const { t } = useTranslation('settings')
  const { data: status, isLoading } = useSyncStatus()

  const isDone = useCallback(
    (intent: OwnerSignInIntent) => {
      if (!status?.ownerSession) return false
      if (intent === 'connect') return status.cloud !== null
      if (intent === 'claim') return Boolean(status.cloud?.ownerEmail)
      return true
    },
    [status],
  )
  const { signIn, waitingFor, error } = useOwnerSignIn(isDone)

  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('sections.sync.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="cloud-sync-section">
      {status.cloud ? (
        <CloudSyncOn
          cloud={status.cloud}
          ownerSession={status.ownerSession}
          signIn={signIn}
          waitingFor={waitingFor}
        />
      ) : (
        <CloudSyncOff
          signIn={signIn}
          waitingFor={waitingFor}
          ownerEmail={status.ownerSession?.email ?? null}
        />
      )}
      {waitingFor && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('sections.cloudSync.signIn.waiting')}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {t('sections.cloudSync.signIn.failed')}
        </p>
      )}
    </div>
  )
}
