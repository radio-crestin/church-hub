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
      className="mb-4 flex items-start gap-3 rounded-xl border border-line p-3"
      data-testid="cloud-backup-warning"
    >
      <KeyRound
        strokeWidth={1.5}
        className="mt-0.5 h-4 w-4 flex-shrink-0 text-fg-label"
      />
      <div>
        <p className="text-sm font-medium text-fg">
          {t('sections.cloudSync.backupWarning.title')}
        </p>
        <p className="mt-0.5 text-xs text-fg-hint">
          {t('sections.cloudSync.backupWarning.body')}
        </p>
      </div>
    </div>
  )
}
