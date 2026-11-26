import { Cloud, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { formatFileSize } from '~/utils/formatFileSize'
import { TOUCH_HEIGHT } from './touchTarget'
import { useCloudBackupAction, useCloudBackupError } from '../hooks'
import {
  type CloudBackupUsage,
  signOutCloudBackup,
} from '../service/cloudBackup'

interface CloudBackupAccountProps {
  email: string | null
  usage: CloudBackupUsage | undefined
}

/**
 * The signed-in account: its email and free storage used, and signing out,
 * plain or with every cloud backup deleted (confirmed first).
 */
export function CloudBackupAccount({ email, usage }: CloudBackupAccountProps) {
  const { t, i18n } = useTranslation('settings')
  const { showToast } = useToast()
  const explain = useCloudBackupError()
  const signOut = useCloudBackupAction(signOutCloudBackup)
  const [confirming, setConfirming] = useState<'plain' | 'delete' | null>(null)

  const confirm = () => {
    const deleteBackups = confirming === 'delete'
    signOut.mutate(deleteBackups, {
      onSuccess: () =>
        showToast(
          t(
            deleteBackups
              ? 'sections.backup.cloud.toast.deletedAll'
              : 'sections.backup.cloud.toast.signedOut',
          ),
          'success',
        ),
      onError: (error) => showToast(explain(error), 'error'),
      onSettled: () => setConfirming(null),
    })
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Cloud
            strokeWidth={1.5}
            className="mt-0.5 h-5 w-5 shrink-0 text-ok"
          />
          <div className="min-w-0">
            <h4
              className="truncate text-sm font-medium text-fg"
              data-testid="cloud-backup-email"
            >
              {t('sections.backup.cloud.signedInAs', { email })}
            </h4>
            {usage && (
              <p className="mt-0.5 text-xs text-fg-hint tabular-nums">
                {t('sections.backup.cloud.usage', {
                  used: formatFileSize(usage.usedBytes, i18n.language),
                  total: formatFileSize(usage.quotaBytes, i18n.language),
                })}
              </p>
            )}
            <p className="mt-0.5 text-xs text-fg-hint">
              {t('sections.backup.cloud.retention', {
                days: usage?.retentionDays ?? 30,
              })}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className={`shrink-0 whitespace-nowrap ${TOUCH_HEIGHT}`}
          onClick={() => setConfirming('plain')}
          disabled={signOut.isPending}
          data-testid="cloud-backup-sign-out"
        >
          <LogOut strokeWidth={1.5} className="h-4 w-4" />
          {t('sections.backup.cloud.signOut')}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setConfirming('delete')}
        disabled={signOut.isPending}
        className="mt-2 rounded-lg py-1 text-xs text-fg-label underline underline-offset-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 max-md:min-h-11"
        data-testid="cloud-backup-delete-account"
      >
        {t('sections.backup.cloud.deleteAccount.button')}
      </button>

      <ConfirmModal
        isOpen={confirming !== null}
        title={t(
          confirming === 'delete'
            ? 'sections.backup.cloud.deleteAccount.title'
            : 'sections.backup.cloud.signOutModal.title',
        )}
        message={t(
          confirming === 'delete'
            ? 'sections.backup.cloud.deleteAccount.message'
            : 'sections.backup.cloud.signOutModal.message',
        )}
        confirmLabel={t(
          confirming === 'delete'
            ? 'sections.backup.cloud.deleteAccount.confirm'
            : 'sections.backup.cloud.signOut',
        )}
        variant={confirming === 'delete' ? 'danger' : 'default'}
        isLoading={signOut.isPending}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
        testId="cloud-backup-sign-out-modal"
      />
    </div>
  )
}
