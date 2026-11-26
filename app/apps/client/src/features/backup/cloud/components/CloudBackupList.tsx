import { CloudDownload, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { formatFileSize } from '~/utils/formatFileSize'
import { CloudBackupErrorText } from './CloudBackupErrorText'
import { TOUCH_HEIGHT, TOUCH_SQUARE } from './touchTarget'
import { useCloudBackupAction, useCloudBackupError } from '../hooks'
import {
  type CloudBackupFile,
  deleteCloudBackup,
  restoreCloudBackup,
} from '../service/cloudBackup'

interface CloudBackupListProps {
  backups: CloudBackupFile[] | undefined
  isLoading: boolean
  error: unknown
}

type Pending = { action: 'restore' | 'delete'; backup: CloudBackupFile }

/** The account's cloud backups, each restorable or deletable (confirmed first). */
export function CloudBackupList({
  backups,
  isLoading,
  error,
}: CloudBackupListProps) {
  const { t, i18n } = useTranslation('settings')
  const { showToast } = useToast()
  const explain = useCloudBackupError()
  const restore = useCloudBackupAction(restoreCloudBackup)
  const remove = useCloudBackupAction(deleteCloudBackup)
  const [pending, setPending] = useState<Pending | null>(null)
  const busy = restore.isPending || remove.isPending
  const dateOf = (backup: CloudBackupFile) =>
    new Date(backup.createdAt).toLocaleString(i18n.language)

  const confirm = () => {
    if (!pending) return
    const { action, backup } = pending
    if (action === 'restore') {
      restore.mutate(backup.id, {
        onSuccess: () => {
          showToast(t('sections.backup.cloud.toast.restored'), 'success')
          setTimeout(() => window.location.reload(), 1000)
        },
        onError: (failure) => showToast(explain(failure), 'error'),
        onSettled: () => setPending(null),
      })
    } else {
      remove.mutate(backup.id, {
        onSuccess: () =>
          showToast(t('sections.backup.cloud.toast.deleted'), 'success'),
        onError: (failure) => showToast(explain(failure), 'error'),
        onSettled: () => setPending(null),
      })
    }
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <h4 className="mb-2 text-sm font-medium text-fg">
        {t('sections.backup.cloud.list.title')}
      </h4>
      {error ? (
        <CloudBackupErrorText>{explain(error)}</CloudBackupErrorText>
      ) : isLoading ? (
        <p className="flex items-center gap-2 text-sm text-fg-hint">
          <Loader2 strokeWidth={1.5} className="h-4 w-4 animate-spin" />
          {t('sections.backup.cloud.list.loading')}
        </p>
      ) : !backups?.length ? (
        <p className="text-sm text-fg-hint" data-testid="cloud-backup-empty">
          {t('sections.backup.cloud.list.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-line" data-testid="cloud-backup-list">
          {backups.map((backup) => (
            <li
              key={backup.id}
              className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
              data-testid="cloud-backup-row"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-fg tabular-nums">
                  {dateOf(backup)}
                </p>
                <p className="text-xs text-fg-hint tabular-nums">
                  {formatFileSize(backup.sizeBytes, i18n.language)}
                  {/^\d/.test(backup.appVersion) && ` · v${backup.appVersion}`}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  size="sm"
                  variant="secondary"
                  className={TOUCH_HEIGHT}
                  disabled={busy}
                  onClick={() => setPending({ action: 'restore', backup })}
                  data-testid="cloud-backup-restore"
                >
                  <CloudDownload strokeWidth={1.5} className="h-4 w-4" />
                  {t('sections.backup.cloud.list.restore')}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className={TOUCH_SQUARE}
                  disabled={busy}
                  onClick={() => setPending({ action: 'delete', backup })}
                  aria-label={t('sections.backup.cloud.list.delete')}
                  title={t('sections.backup.cloud.list.delete')}
                  data-testid="cloud-backup-delete"
                >
                  <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={pending !== null}
        title={t(
          pending?.action === 'delete'
            ? 'sections.backup.cloud.deleteModal.title'
            : 'sections.backup.cloud.restoreModal.title',
        )}
        message={
          pending
            ? t(
                pending.action === 'delete'
                  ? 'sections.backup.cloud.deleteModal.message'
                  : 'sections.backup.cloud.restoreModal.message',
                { date: dateOf(pending.backup) },
              )
            : ''
        }
        confirmLabel={t(
          pending?.action === 'delete'
            ? 'sections.backup.cloud.deleteModal.confirm'
            : 'sections.backup.cloud.restoreModal.confirm',
        )}
        variant={pending?.action === 'delete' ? 'danger' : 'default'}
        isLoading={busy}
        onConfirm={confirm}
        onCancel={() => !busy && setPending(null)}
        testId="cloud-backup-confirm"
      />
    </div>
  )
}
