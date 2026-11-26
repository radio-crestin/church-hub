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

  // --- Status still loading: the local card in its loading layout and a
  // placeholder for Drive, never a guessed state whose buttons then move ---
  if (backup.isLoadingStatus) {
    return (
      <div className="space-y-4">
        <LocalBackupPanel
          localBackupPath={null}
          lastLocalBackupAt={null}
          isLoading
        />
        <div
          className="h-[74px] rounded-xl bg-field"
          data-testid="backup-drive-loading"
        />
      </div>
    )
  }

  // --- Not connected: either first-time setup, or a session that expired ---
  if (!backup.connected) {
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
          isLoading={false}
        />
        <div
          className={`rounded-xl p-4 ${
            sessionExpired
              ? 'border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
              : 'border border-line'
          }`}
        >
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                {sessionExpired ? (
                  <AlertTriangle
                    strokeWidth={1.5}
                    className="h-5 w-5 text-amber-600 dark:text-amber-400"
                  />
                ) : (
                  <Cloud strokeWidth={1.5} className="h-5 w-5 text-fg-label" />
                )}
              </div>
              <div>
                <h4 className="text-[13px] font-medium text-fg">
                  {t(
                    sessionExpired
                      ? 'sections.backup.expired.title'
                      : 'sections.backup.connect.title',
                  )}
                </h4>
                <p className="mt-0.5 text-xs text-fg-hint">
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
                className={`inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium text-white disabled:opacity-50 ${
                  sessionExpired
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-primary hover:bg-indigo-700'
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
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1 text-xs text-fg-label hover:text-fg"
                title={t('sections.backup.copyLinkHint')}
              >
                <Copy strokeWidth={1.75} className="h-3.5 w-3.5" />
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
                  className="h-8 w-full rounded-[10px] bg-field px-2.5 font-mono text-xs text-fg-body focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                />
                <button
                  type="button"
                  onClick={handleCopyShownUrl}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-field px-2.5 text-xs font-medium text-fg hover:bg-hover"
                >
                  <Copy strokeWidth={1.75} className="h-3.5 w-3.5" />
                  {t('sections.backup.copyLink')}
                </button>
              </div>
              <p className="mt-1 text-xs text-fg-hint">
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
        isLoading={false}
      />

      {/* Connection status row */}
      <div className="flex flex-col items-start gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <Cloud strokeWidth={1.5} className="h-5 w-5 text-ok" />
          </div>
          <div>
            <h4 className="text-[13px] font-medium text-fg">
              {t('sections.backup.status.connected')}
            </h4>
            {backup.email && (
              <p className="mt-0.5 text-xs text-fg-hint">{backup.email}</p>
            )}
            {backup.storage && backup.storage.limitBytes !== null && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-hint">
                <HardDrive strokeWidth={1.75} className="h-3.5 w-3.5" />
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
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-red-600 px-3 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <LogOut strokeWidth={1.5} className="h-4 w-4" />
          {t('sections.backup.status.disconnect')}
        </button>
      </div>

      {/* Reconnect banner when the Drive scope is missing */}
      {backup.requiresReconnect && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle
              strokeWidth={1.5}
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
            />
            <p className="text-[13px] text-amber-800 dark:text-amber-300">
              {t('sections.backup.reconnect.message')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => backup.connect()}
            disabled={backup.isAuthenticating}
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-amber-600 px-3 text-[13px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
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
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle
            strokeWidth={1.5}
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400"
          />
          <div>
            <p className="text-[13px] font-medium text-red-800 dark:text-red-300">
              {t('sections.backup.storage.warningTitle')}
            </p>
            <p className="mt-0.5 text-[13px] text-red-700 dark:text-red-400">
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
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <CloudUpload
                    strokeWidth={1.5}
                    className="h-5 w-5 text-fg-label"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[13px] font-medium text-fg">
                    {t('sections.backup.now.title')}
                  </h4>
                  <p className="mt-0.5 text-xs text-fg-hint">
                    {t('sections.backup.now.lastBackup')}:{' '}
                    {formatDate(backup.lastBackupAt ?? 0)}
                  </p>
                  <button
                    type="button"
                    onClick={handleBackupNow}
                    disabled={backup.isBackingUp}
                    className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {backup.isBackingUp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudUpload strokeWidth={1.5} className="h-4 w-4" />
                    )}
                    {backup.isBackingUp
                      ? t('sections.backup.now.backingUp')
                      : t('sections.backup.now.button')}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-backup */}
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[13px] font-medium text-fg">
                    {t('sections.backup.auto.title')}
                  </h4>
                  <p className="mt-0.5 text-xs text-fg-hint">
                    {t('sections.backup.auto.description')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAuto}
                  disabled={backup.isUpdatingConfig}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    backup.autoBackupEnabled ? 'bg-primary' : 'bg-line-strong'
                  } ${backup.isUpdatingConfig ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-panel shadow ring-0 transition duration-200 ease-in-out ${
                      backup.autoBackupEnabled
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {backup.autoBackupEnabled && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-fg-label">
                    {t('sections.backup.auto.interval')}
                  </p>
                  <div className="inline-flex flex-wrap gap-1 rounded-lg bg-field p-1">
                    {INTERVAL_OPTIONS.map((h) => {
                      const selected = backup.intervalHours === h
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleIntervalChange(h)}
                          disabled={backup.isUpdatingConfig}
                          aria-pressed={selected}
                          className={`min-w-[3rem] rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            selected
                              ? 'bg-selected text-fg'
                              : 'text-fg-label hover:bg-hover hover:text-fg'
                          }`}
                        >
                          {intervalLabel(h)}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-fg-hint">
                    {t('sections.backup.auto.everyHours', {
                      hours: backup.intervalHours,
                    })}
                  </p>
                </div>
              )}

              {/* Retention: applies to manual and automatic backups alike */}
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-fg-label">
                      {t('sections.backup.retention.title')}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-hint">
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
                    className="h-8 w-16 shrink-0 rounded-[10px] bg-field px-2 text-center text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Backup list */}
          <div className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-[13px] font-medium text-fg">
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-50"
              >
                <RefreshCw
                  strokeWidth={1.5}
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
              <p className="text-[13px] text-red-600 dark:text-red-400">
                {backup.backupsError}
              </p>
            ) : backup.isLoadingBackups ? (
              <div className="flex items-center gap-2 text-[13px] text-fg-hint">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('sections.backup.list.loading')}
              </div>
            ) : backup.backups.length === 0 ? (
              <p className="text-[13px] text-fg-hint">
                {t('sections.backup.list.empty')}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {backup.backups.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-fg">
                        {formatDate(file.createdAtMs)}
                      </p>
                      <p className="text-xs text-fg-hint">
                        {formatBytes(file.sizeBytes)}
                        {file.appVersion ? ` · v${file.appVersion}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setInspecting(file)}
                        title={t('sections.backup.list.inspect')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
                      >
                        <Eye strokeWidth={1.5} className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingRestore(file)}
                        disabled={backup.isRestoring}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-field px-3 text-[13px] font-medium text-fg hover:bg-hover disabled:opacity-50"
                      >
                        <CloudDownload strokeWidth={1.5} className="h-4 w-4" />
                        {t('sections.backup.list.restore')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(file)}
                        disabled={backup.isDeleting}
                        title={t('sections.backup.list.delete')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                      >
                        <Trash2 strokeWidth={1.5} className="h-4 w-4" />
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
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-line bg-panel shadow-popover p-6">
            {backup.isRestoring && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-panel/80">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-fg-hint" />
                  <span className="text-sm font-medium text-fg-body">
                    {t('sections.backup.restoreModal.restoring')}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-4">
              <AlertTriangle
                strokeWidth={1.5}
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-fg">
                  {t('sections.backup.restoreModal.title')}
                </h3>
                <p className="mt-2 text-[13px] text-fg-label">
                  {t('sections.backup.restoreModal.message', {
                    date: formatDate(pendingRestore.createdAtMs),
                  })}
                </p>
                <p className="mt-2 text-[13px] font-medium text-amber-700 dark:text-amber-400">
                  {t('sections.backup.restoreModal.warning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={backup.isRestoring}
                className="h-9 rounded-lg bg-field px-3.5 text-[13px] font-medium text-fg hover:bg-hover disabled:opacity-50"
              >
                {t('sections.backup.restoreModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleRestoreConfirm}
                disabled={backup.isRestoring}
                className="flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-3.5 text-[13px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
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
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-line bg-panel shadow-popover p-6">
            <div className="flex items-start gap-4">
              <Trash2
                strokeWidth={1.5}
                className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-fg">
                  {t('sections.backup.deleteModal.title')}
                </h3>
                <p className="mt-2 text-[13px] text-fg-label">
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
                className="h-9 rounded-lg bg-field px-3.5 text-[13px] font-medium text-fg hover:bg-hover disabled:opacity-50"
              >
                {t('sections.backup.deleteModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={backup.isDeleting}
                className="flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3.5 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
