import {
  AlertTriangle,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Loader2,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useBackup } from '../hooks/useBackup'
import type { BackupFile } from '../service'
import { buildGoogleAuthUrl } from '../utils/googleAuthUrl'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function formatDate(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

const INTERVAL_OPTIONS = [6, 12, 24, 48, 168]

export function BackupManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const backup = useBackup()
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null)

  const handleBackupNow = useCallback(async () => {
    const result = await backup.backupNow()
    if (result.success) {
      showToast(t('sections.backup.toast.backupSuccess'), 'success')
    } else if (result.requiresReconnect) {
      showToast(t('sections.backup.toast.reconnectNeeded'), 'error')
    } else {
      showToast(
        t('sections.backup.toast.backupFailed', { error: result.error }),
        'error',
      )
    }
  }, [backup, showToast, t])

  const handleRestoreConfirm = useCallback(async () => {
    if (!pendingRestore) return
    const result = await backup.restore(pendingRestore.id)
    setPendingRestore(null)
    if (result.success) {
      showToast(t('sections.backup.toast.restoreSuccess'), 'success')
      setTimeout(() => window.location.reload(), 1000)
    } else if (result.requiresReconnect) {
      showToast(t('sections.backup.toast.reconnectNeeded'), 'error')
    } else {
      showToast(
        t('sections.backup.toast.restoreFailed', { error: result.error }),
        'error',
      )
    }
  }, [pendingRestore, backup, showToast, t])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildGoogleAuthUrl())
      showToast(t('sections.backup.toast.linkCopied'), 'success')
    } catch {
      showToast(t('sections.backup.toast.linkCopyFailed'), 'error')
    }
  }, [showToast, t])

  const handleToggleAuto = useCallback(async () => {
    try {
      await backup.updateConfig({
        autoBackupEnabled: !backup.autoBackupEnabled,
      })
    } catch {
      showToast(t('sections.backup.toast.configFailed'), 'error')
    }
  }, [backup, showToast, t])

  const handleIntervalChange = useCallback(
    async (hours: number) => {
      try {
        await backup.updateConfig({ intervalHours: hours })
      } catch {
        showToast(t('sections.backup.toast.configFailed'), 'error')
      }
    },
    [backup, showToast, t],
  )

  // --- Not connected: either first-time setup, or a session that expired ---
  if (!backup.connected && !backup.isLoadingStatus) {
    // If the user previously backed up or has auto-backup on, the connection was
    // lost rather than never made — most commonly the Google refresh token
    // expired (this happens weekly while the OAuth app is in "Testing" mode).
    // Surface that as an explicit "reconnect" warning instead of a neutral prompt.
    const sessionExpired =
      backup.lastBackupAt !== null || backup.autoBackupEnabled
    return (
      <div
        className={`rounded-lg p-4 ${
          sessionExpired
            ? 'border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            : 'bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-lg p-2 ${
                sessionExpired
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-indigo-100 dark:bg-indigo-900/30'
              }`}
            >
              {sessionExpired ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <Cloud className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t(
                  sessionExpired
                    ? 'sections.backup.expired.title'
                    : 'sections.backup.connect.title',
                )}
              </h4>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t(
                  sessionExpired
                    ? 'sections.backup.expired.description'
                    : 'sections.backup.connect.description',
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            <button
              type="button"
              onClick={() => backup.connect()}
              disabled={backup.isAuthenticating}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50 ${
                sessionExpired
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {backup.isAuthenticating && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t(
                sessionExpired
                  ? 'sections.backup.expired.button'
                  : 'sections.backup.connect.button',
              )}
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              title={t('sections.backup.copyLinkHint')}
            >
              <Copy className="h-3.5 w-3.5" />
              {t('sections.backup.copyLink')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connection status row */}
      <div className="flex flex-col items-start gap-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
            <Cloud className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {t('sections.backup.status.connected')}
            </h4>
            {backup.channelName && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {backup.channelName}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => backup.disconnect()}
          disabled={backup.isDisconnecting}
          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <LogOut className="h-4 w-4" />
          {t('sections.backup.status.disconnect')}
        </button>
      </div>

      {/* Reconnect banner when the Drive scope is missing */}
      {backup.requiresReconnect && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t('sections.backup.reconnect.message')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => backup.connect()}
            disabled={backup.isAuthenticating}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {backup.isAuthenticating && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {t('sections.backup.reconnect.button')}
          </button>
        </div>
      )}

      {backup.driveReady && (
        <>
          {/* Backup now + auto-backup */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Manual backup */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
                  <CloudUpload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('sections.backup.now.title')}
                  </h4>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t('sections.backup.now.lastBackup')}:{' '}
                    {formatDate(backup.lastBackupAt ?? 0)}
                  </p>
                  <button
                    type="button"
                    onClick={handleBackupNow}
                    disabled={backup.isBackingUp}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {backup.isBackingUp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudUpload className="h-4 w-4" />
                    )}
                    {backup.isBackingUp
                      ? t('sections.backup.now.backingUp')
                      : t('sections.backup.now.button')}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-backup */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('sections.backup.auto.title')}
                  </h4>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {t('sections.backup.auto.description')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAuto}
                  disabled={backup.isUpdatingConfig}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                    backup.autoBackupEnabled
                      ? 'bg-indigo-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  } ${backup.isUpdatingConfig ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      backup.autoBackupEnabled
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {backup.autoBackupEnabled && (
                <label className="mt-3 block text-xs text-gray-600 dark:text-gray-400">
                  {t('sections.backup.auto.interval')}
                  <select
                    value={backup.intervalHours}
                    onChange={(e) =>
                      handleIntervalChange(Number(e.target.value))
                    }
                    disabled={backup.isUpdatingConfig}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    {INTERVAL_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {t('sections.backup.auto.everyHours', { hours: h })}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {/* Backup list */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <h4 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
              {t('sections.backup.list.title')}
            </h4>
            {backup.isLoadingBackups ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('sections.backup.list.loading')}
              </div>
            ) : backup.backups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('sections.backup.list.empty')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {backup.backups.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-900 dark:text-white">
                        {formatDate(file.createdAtMs)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(file.sizeBytes)}
                        {file.appVersion ? ` · v${file.appVersion}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingRestore(file)}
                      disabled={backup.isRestoring}
                      className="inline-flex items-center gap-2 self-start rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:self-auto"
                    >
                      <CloudDownload className="h-4 w-4" />
                      {t('sections.backup.list.restore')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Restore confirmation modal */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={
              !backup.isRestoring ? () => setPendingRestore(null) : undefined
            }
            onKeyDown={(e) =>
              e.key === 'Escape' &&
              !backup.isRestoring &&
              setPendingRestore(null)
            }
          />
          <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            {backup.isRestoring && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 dark:bg-gray-800/80">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('sections.backup.restoreModal.restoring')}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sections.backup.restoreModal.title')}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('sections.backup.restoreModal.message', {
                    date: formatDate(pendingRestore.createdAtMs),
                  })}
                </p>
                <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  {t('sections.backup.restoreModal.warning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={backup.isRestoring}
                className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('sections.backup.restoreModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleRestoreConfirm}
                disabled={backup.isRestoring}
                className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {backup.isRestoring && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                {t('sections.backup.restoreModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
