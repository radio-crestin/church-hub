import { CloudUpload, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { useToast } from '~/ui/toast'
import { useCloudBackupAction, useCloudBackupError } from '../hooks'
import { backUpToCloudNow } from '../service/cloudBackup'

/** "Back up now", with when the last cloud backup from this PC was made. */
export function CloudBackupNow({
  lastBackupAt,
}: {
  lastBackupAt: number | null
}) {
  const { t, i18n } = useTranslation('settings')
  const { showToast } = useToast()
  const explain = useCloudBackupError()
  const backUp = useCloudBackupAction(backUpToCloudNow)

  const run = () =>
    backUp.mutate(undefined, {
      onSuccess: () =>
        showToast(t('sections.backup.cloud.toast.backedUp'), 'success'),
      onError: (error) => showToast(explain(error), 'error'),
    })

  return (
    <div className="rounded-xl border border-line p-4">
      <h4 className="text-sm font-medium text-fg">
        {t('sections.backup.cloud.now.title')}
      </h4>
      <p className="mt-0.5 text-xs text-fg-hint tabular-nums">
        {lastBackupAt
          ? t('sections.backup.cloud.now.last', {
              date: new Date(lastBackupAt).toLocaleString(i18n.language),
            })
          : t('sections.backup.cloud.now.never')}
      </p>
      <Button
        size="sm"
        className="mt-3"
        onClick={run}
        disabled={backUp.isPending}
        data-testid="cloud-backup-now"
      >
        {backUp.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CloudUpload strokeWidth={1.5} className="h-4 w-4" />
        )}
        {t(
          backUp.isPending
            ? 'sections.backup.cloud.now.running'
            : 'sections.backup.cloud.now.button',
        )}
      </Button>
      <p className="mt-2 text-xs text-fg-hint">
        {t('sections.backup.cloud.now.encrypted')}
      </p>
    </div>
  )
}
