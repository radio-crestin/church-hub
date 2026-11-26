import { CloudOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Shown while this build points at the legacy backend: no sign-in to offer yet. */
export function CloudBackupUnavailable() {
  const { t } = useTranslation('settings')
  return (
    <div
      className="rounded-xl border border-line p-4"
      data-testid="cloud-backup-unavailable"
    >
      <div className="flex items-start gap-3">
        <CloudOff
          strokeWidth={1.5}
          className="mt-0.5 h-5 w-5 shrink-0 text-fg-label"
        />
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-fg">
            {t('sections.backup.cloud.unavailable.title')}
          </h4>
          <p className="mt-0.5 text-xs text-fg-hint">
            {t('sections.backup.cloud.unavailable.description')}
          </p>
        </div>
      </div>
    </div>
  )
}
