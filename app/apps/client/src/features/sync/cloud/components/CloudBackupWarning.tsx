import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSyncStatus } from '../../hooks/useSyncStatus'

/**
 * On the backup screen while cloud sync is on: a backup holds the church's
 * cloud keys (its id, path and server token), so it must be kept private.
 */
export function CloudBackupWarning() {
  const { t } = useTranslation('settings')
  const { data: status } = useSyncStatus()
  if (!status?.cloud) return null

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
      data-testid="cloud-backup-warning"
    >
      <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <p className="font-medium">
          {t('sections.cloudSync.backupWarning.title')}
        </p>
        <p className="mt-0.5 text-xs">
          {t('sections.cloudSync.backupWarning.body')}
        </p>
      </div>
    </div>
  )
}
