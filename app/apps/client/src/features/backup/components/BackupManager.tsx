import {
  AlertTriangle,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Eye,
  HardDrive,
  Loader2,
  LogOut,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { BackupContentsModal } from './BackupContentsModal'
import { LocalBackupPanel } from './LocalBackupPanel'
import { useBackup } from '../hooks/useBackup'
import type { BackupFile } from '../service'

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

/** Compact, unit-agnostic label for an interval pill: 6→"6h", 24→"1d", 168→"7d". */
function intervalLabel(hours: number): string {
  return hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`
}

const INTERVAL_OPTIONS = [6, 12, 24, 48, 168]

const MIN_RETAINED_BACKUPS = 1
const MAX_RETAINED_BACKUPS = 50

export function BackupManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const backup = useBackup()
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BackupFile | null>(null)
  const [inspecting, setInspecting] = useState<BackupFile | null>(null)
  const [connectUrl, setConnectUrl] = useState<string | null>(null)
  const [retentionDraft, setRetentionDraft] = useState<string>(
    String(backup.maxBackups),
  )

  // Keep the retention input in sync when the saved value loads/changes.
  useEffect(() => {
    setRetentionDraft(String(backup.maxBackups))
  }, [backup.maxBackups])

  const handleBackupNow = useCallback(async () => {
    const result = await backup.backupNow()
    if (result.success) {
      showToast(t('sections.backup.toast.backupSuccess'), 'success')
    } else if (result.requiresReconnect) {
      showToast(t('sections.backup.toast.reconnectNeeded'), 'error')
    } else if (result.error === 'insufficient_drive_space') {
      showToast(t('sections.backup.toast.insufficientSpace'), 'error')
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

  // Reveal the sign-in link (and best-effort auto-copy). We fetch the URL first,
  // which consumes the click's user-activation, so clipboard.writeText may be
  // blocked — hence we always show the link in a field for manual copy too.
  const handleShowLink = useCallback(async () => {
    try {
      const { authUrl } = await backup.getConnectUrl()
      if (!authUrl) {
        showToast(t('sections.backup.toast.linkCopyFailed'), 'error')
        return
      }
      setConnectUrl(authUrl)
      try {
        await navigator.clipboard.writeText(authUrl)
        showToast(t('sections.backup.toast.linkCopied'), 'success')
      } catch {
        showToast(t('sections.backup.toast.linkShown'), 'success')
      }
    } catch {
      showToast(t('sections.backup.toast.linkCopyFailed'), 'error')
    }
  }, [backup, showToast, t])

  // Copy synchronously from state (no await before the clipboard call), so the
  // click's user-activation is still valid.
  const handleCopyShownUrl = useCallback(async () => {
    if (!connectUrl) return
    try {
      await navigator.clipboard.writeText(connectUrl)
      showToast(t('sections.backup.toast.linkCopied'), 'success')
    } catch {
      showToast(t('sections.backup.toast.linkCopyFailed'), 'error')
    }
  }, [connectUrl, showToast, t])

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return
    const result = await backup.deleteBackup(pendingDelete.id)
    setPendingDelete(null)
    if (result.success) {
      showToast(t('sections.backup.toast.deleteSuccess'), 'success')
    } else if (result.requiresReconnect) {
      showToast(t('sections.backup.toast.reconnectNeeded'), 'error')
    } else {
      showToast(
        t('sections.backup.toast.deleteFailed', { error: result.error }),
        'error',
      )
    }
  }, [pendingDelete, backup, showToast, t])

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

  // Commit the retention input on blur/Enter, clamped to the allowed range;
  // an unparsable draft just snaps back to the saved value.
  const handleRetentionCommit = useCallback(async () => {
    const parsed = Number.parseInt(retentionDraft, 10)
    if (Number.isNaN(parsed)) {
      setRetentionDraft(String(backup.maxBackups))
      return
    }
    const clamped = Math.min(
      Math.max(parsed, MIN_RETAINED_BACKUPS),
      MAX_RETAINED_BACKUPS,
    )
    setRetentionDraft(String(clamped))
    if (clamped === backup.maxBackups) return
    try {
      await backup.updateConfig({ maxBackups: clamped })
    } catch {
      setRetentionDraft(String(backup.maxBackups))
      showToast(t('sections.backup.toast.configFailed'), 'error')
    }
  }, [retentionDraft, backup, showToast, t])

  // --- Not connected: either first-time setup, or a session that expired ---
  if (!backup.connected && !backup.isLoadingStatus) {
    // If the user previously backed up or has auto-backup on, the connection was
    // lost rather than never made — most commonly the Google refresh token
    // expired (this happens weekly while the OAuth app is in "Testing" mode).
    // Surface that as an explicit "reconnect" warning instead of a neutral prompt.
    const sessionExpired =
      backup.lastBackupAt !== null || backup.autoBackupEnabled
    return (
      <div className="space-y-4">
        {/* Local backups need no Google account, so they stay available on the
            not-connected screen — for many operators this is the whole
            backup story. */}
        <LocalBackupPanel
          localBackupPath={backup.localBackupPath}
          lastLocalBackupAt={backup.lastLocalBackupAt}
        />
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
                onClick={handleShowLink}
                className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                title={t('sections.backup.copyLinkHint')}
              >
                <Copy className="h-3.5 w-3.5" />
                {t('sections.backup.copyLink')}
              </button>
            </div>
          </div>
          {connectUrl && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={connectUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                />
                <button
                  type="button"
                  onClick={handleCopyShownUrl}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t('sections.backup.copyLink')}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('sections.backup.copyLinkHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <LocalBackupPanel
        localBackupPath={backup.localBackupPath}
        lastLocalBackupAt={backup.lastLocalBackupAt}
      />

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
            {backup.email && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {backup.email}
              </p>
            )}
            {backup.storage && backup.storage.limitBytes !== null && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <HardDrive className="h-3.5 w-3.5" />
                {t('sections.backup.storage.summary', {
                  used: formatBytes(backup.storage.usageBytes),
                  total: formatBytes(backup.storage.limitBytes),
                  free: formatBytes(backup.storage.availableBytes ?? 0),
                })}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => backup.disconnect()}
          disabled={backup.isDisconnecting}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
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

      {/* Insufficient Drive space: warn before a backup would fail */}
      {backup.driveReady && backup.storage?.insufficientSpace && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {t('sections.backup.storage.warningTitle')}
            </p>
            <p className="mt-0.5 text-sm text-red-700 dark:text-red-400">
              {t('sections.backup.storage.warningMessage', {
                free: formatBytes(backup.storage.availableBytes ?? 0),
                needed: formatBytes(backup.storage.dbSizeBytes),
              })}
            </p>
          </div>
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
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t('sections.backup.auto.interval')}
                  </p>
                  <div className="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
                    {INTERVAL_OPTIONS.map((h) => {
                      const selected = backup.intervalHours === h
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleIntervalChange(h)}
                          disabled={backup.isUpdatingConfig}
                          aria-pressed={selected}
                          className={`min-w-[3rem] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                            selected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                          }`}
                        >
                          {intervalLabel(h)}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {t('sections.backup.auto.everyHours', {
                      hours: backup.intervalHours,
                    })}
                  </p>
                </div>
              )}

              {/* Retention: applies to manual and automatic backups alike */}
              <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t('sections.backup.retention.title')}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {t('sections.backup.retention.description', {
                        total: backup.maxBackups,
                      })}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={MIN_RETAINED_BACKUPS}
                    max={MAX_RETAINED_BACKUPS}
                    value={retentionDraft}
                    onChange={(e) => setRetentionDraft(e.target.value)}
                    onBlur={handleRetentionCommit}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && e.currentTarget.blur()
                    }
                    disabled={backup.isUpdatingConfig}
                    aria-label={t('sections.backup.retention.title')}
                    className="w-16 shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Backup list */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('sections.backup.list.title')}
              </h4>
              <button
                type="button"
                onClick={() => backup.refetchBackups()}
                disabled={
                  backup.isFetchingBackups ||
                  backup.isAwaitingBackup ||
                  backup.isBackingUp
                }
                title={t('sections.backup.list.refresh')}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    backup.isFetchingBackups ||
                    backup.isAwaitingBackup ||
                    backup.isBackingUp
                      ? 'animate-spin'
                      : ''
                  }`}
                />
              </button>
            </div>
            {backup.backupsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {backup.backupsError}
              </p>
            ) : backup.isLoadingBackups ? (
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
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setInspecting(file)}
                        title={t('sections.backup.list.inspect')}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingRestore(file)}
                        disabled={backup.isRestoring}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <CloudDownload className="h-4 w-4" />
                        {t('sections.backup.list.restore')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(file)}
                        disabled={backup.isDeleting}
                        title={t('sections.backup.list.delete')}
                        className="inline-flex items-center justify-center rounded-md border border-red-300 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Backup contents modal */}
      {inspecting && (
        <BackupContentsModal
          file={inspecting}
          onClose={() => setInspecting(null)}
        />
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

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={
              !backup.isDeleting ? () => setPendingDelete(null) : undefined
            }
            onKeyDown={(e) =>
              e.key === 'Escape' && !backup.isDeleting && setPendingDelete(null)
            }
          />
          <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sections.backup.deleteModal.title')}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('sections.backup.deleteModal.message', {
                    date: formatDate(pendingDelete.createdAtMs),
                  })}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={backup.isDeleting}
                className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('sections.backup.deleteModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={backup.isDeleting}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {backup.isDeleting && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                {t('sections.backup.deleteModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
