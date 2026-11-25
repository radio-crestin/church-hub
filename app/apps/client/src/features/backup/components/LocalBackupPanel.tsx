import {
  AlertTriangle,
  FolderOpen,
  FolderSearch,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { isTauri } from '~/utils/isTauri'
import { useLocalBackup } from '../hooks/useLocalBackup'
import type { LocalBackupFile } from '../service'

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

interface LocalBackupPanelProps {
  /** Currently configured folder, from the backup status payload. */
  localBackupPath: string | null
  lastLocalBackupAt: number | null
  /** The backup status is still loading: the folder is not known yet. */
  isLoading: boolean
}

/**
 * On-disk backups: pick a folder, back up into it on demand, and manage what's
 * there.
 *
 * Its layout is the same while the status loads and once it has: every button
 * keeps its place and the list has a fixed height, so nothing moves under the
 * pointer (a "Remove" that slid under "Choose folder" once cleared the folder).
 *
 * Rendered above the Drive card and outside its "not connected" early return —
 * a local copy needs no Google account, and it is the only backup an operator
 * without one can make. Once a folder is set, the auto-backup scheduler writes
 * here too, before it touches Drive.
 */
export function LocalBackupPanel({
  localBackupPath,
  lastLocalBackupAt,
  isLoading,
}: LocalBackupPanelProps) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const hasPath = !!localBackupPath
  // A folder the operator is looking inside to restore from. Separate from the
  // configured path on purpose: restoring last month's copy off a stick should
  // not redirect where tonight's backup is written.
  const [browseDir, setBrowseDir] = useState<string | null>(null)
  const local = useLocalBackup(hasPath, browseDir)
  const [pendingDelete, setPendingDelete] = useState<LocalBackupFile | null>(
    null,
  )
  const [pendingRestore, setPendingRestore] = useState<LocalBackupFile | null>(
    null,
  )
  const [pendingClear, setPendingClear] = useState(false)
  // Non-Tauri (browser) has no folder picker, so the path is typed there.
  const [pathDraft, setPathDraft] = useState(localBackupPath ?? '')

  useEffect(() => {
    setPathDraft(localBackupPath ?? '')
  }, [localBackupPath])

  const savePath = useCallback(
    async (path: string | null) => {
      try {
        await local.setPath(path)
        showToast(
          path
            ? t('sections.backup.local.pathSaved')
            : t('sections.backup.local.pathCleared'),
          'success',
        )
      } catch {
        showToast(t('sections.backup.toast.configFailed'), 'error')
      }
    },
    [local, showToast, t],
  )

  const handleClearConfirm = useCallback(async () => {
    await savePath(null)
    setPendingClear(false)
  }, [savePath])

  /** Native folder picker in the desktop app; typed path in the browser. */
  const handleChooseFolder = useCallback(async () => {
    if (!isTauri()) return
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('sections.backup.local.chooseFolder'),
      defaultPath: localBackupPath ?? undefined,
    })
    if (typeof selected === 'string' && selected) {
      await savePath(selected)
    }
  }, [localBackupPath, savePath, t])

  const handleBackupNow = useCallback(async () => {
    const result = await local.backupNow()
    if (result.success) {
      showToast(t('sections.backup.local.toast.success'), 'success')
    } else {
      showToast(t('sections.backup.local.toast.failed'), 'error')
    }
  }, [local, showToast, t])

  /**
   * Picks a folder to restore *from*. Unlike `handleChooseFolder` this never
   * writes the choice to the config — it only points the listing somewhere else.
   */
  const handleBrowseFolder = useCallback(async () => {
    if (!isTauri()) return
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('sections.backup.local.restoreFrom.choose'),
      defaultPath: browseDir ?? localBackupPath ?? undefined,
    })
    if (typeof selected === 'string' && selected) {
      setBrowseDir(selected)
    }
  }, [browseDir, localBackupPath, t])

  const handleRestoreConfirm = useCallback(async () => {
    if (!pendingRestore) return
    // Sends the absolute path when browsing another folder, and the bare file
    // name when it came from the configured one — the server resolves the latter
    // inside that folder and refuses anything that tries to leave it.
    const result = await local.restore(
      browseDir
        ? { path: pendingRestore.path }
        : { fileName: pendingRestore.name },
    )
    setPendingRestore(null)

    if (!result.success) {
      showToast(t('sections.backup.local.toast.restoreFailed'), 'error')
      return
    }
    if (result.requiresRestart) {
      // The file was swapped but the database could not be reopened in place;
      // reloading the page would not reconnect it, so say what actually helps.
      showToast(t('sections.backup.local.toast.restoreNeedsRestart'), 'error')
      return
    }
    showToast(t('sections.backup.local.toast.restoreSuccess'), 'success')
    // Every cached query now describes the old database — start clean.
    setTimeout(() => window.location.reload(), 1000)
  }, [pendingRestore, browseDir, local, showToast, t])

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete) return
    const result = await local.deleteBackup(pendingDelete.name)
    setPendingDelete(null)
    if (result.success) {
      showToast(t('sections.backup.local.toast.deleteSuccess'), 'success')
    } else {
      showToast(t('sections.backup.local.toast.deleteFailed'), 'error')
    }
  }, [pendingDelete, local, showToast, t])

  return (
    <div
      className="rounded-xl border border-line p-4"
      data-testid="local-backup-panel"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <HardDriveDownload
            strokeWidth={1.5}
            className="h-5 w-5 text-fg-label"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-medium text-fg">
            {t('sections.backup.local.title')}
          </h4>
          <p className="mt-0.5 text-xs text-fg-hint">
            {t('sections.backup.local.description')}
          </p>

          {/* Folder configuration */}
          <div className="mt-3">
            <span className="block text-xs font-medium text-fg-label">
              {t('sections.backup.local.folderLabel')}
            </span>
            {isTauri() ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code
                  className="min-w-0 flex-1 truncate rounded-[10px] bg-field px-3 py-2 text-xs text-fg-body"
                  title={localBackupPath ?? undefined}
                  data-testid="local-backup-path"
                >
                  {isLoading ? (
                    <span className="block h-4 w-2/3 rounded bg-hover" />
                  ) : (
                    (localBackupPath ?? t('sections.backup.local.noFolder'))
                  )}
                </code>
                <button
                  type="button"
                  onClick={handleChooseFolder}
                  disabled={isLoading || local.isSettingPath}
                  data-testid="local-backup-choose"
                  className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-field px-3 text-[13px] font-medium text-fg hover:bg-hover disabled:opacity-50"
                >
                  <FolderOpen strokeWidth={1.5} className="h-4 w-4" />
                  {t('sections.backup.local.chooseFolder')}
                </button>
                {/* Always laid out, hidden without a folder, so its arrival
                    never pushes "Choose folder" aside. */}
                <button
                  type="button"
                  onClick={() => setPendingClear(true)}
                  disabled={!hasPath || local.isSettingPath}
                  aria-hidden={!hasPath}
                  data-testid="local-backup-clear"
                  className={`shrink-0 rounded-lg px-2 py-2 text-xs text-fg-hint hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400 ${hasPath ? '' : 'invisible'}`}
                >
                  {t('sections.backup.local.clearFolder')}
                </button>
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={pathDraft}
                  onChange={(e) => setPathDraft(e.target.value)}
                  onBlur={() => {
                    const next = pathDraft.trim()
                    if (next !== (localBackupPath ?? '')) {
                      savePath(next || null)
                    }
                  }}
                  placeholder={t('sections.backup.local.pathPlaceholder')}
                  disabled={isLoading}
                  data-testid="local-backup-path-input"
                  className="h-8 min-w-0 flex-1 rounded-[10px] bg-field px-3 text-[13px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                />
              </div>
            )}
            <p className="mt-1 text-xs text-fg-hint">
              {t('sections.backup.local.folderHint')}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBackupNow}
              disabled={!hasPath || local.isBackingUp}
              data-testid="local-backup-now"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {local.isBackingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDriveDownload strokeWidth={1.5} className="h-4 w-4" />
              )}
              {local.isBackingUp
                ? t('sections.backup.local.backingUp')
                : t('sections.backup.local.button')}
            </button>
            {isTauri() && (
              <button
                type="button"
                onClick={handleBrowseFolder}
                data-testid="local-backup-browse"
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-field px-3 text-[13px] font-medium text-fg hover:bg-hover"
              >
                <FolderSearch strokeWidth={1.5} className="h-4 w-4" />
                {t('sections.backup.local.restoreFrom.button')}
              </button>
            )}
          </div>
          {/* Its own line: a date arriving after the load never wraps the
              buttons above onto a second row. */}
          <p className="mt-2 truncate text-xs text-fg-hint">
            {t('sections.backup.local.lastBackup')}:{' '}
            {formatDate(lastLocalBackupAt ?? 0)}
          </p>

          {/* Restore-from folder, typed where there is no native picker */}
          {!isTauri() && (
            <div className="mt-3">
              <span className="block text-xs font-medium text-fg-label">
                {t('sections.backup.local.restoreFrom.label')}
              </span>
              <input
                type="text"
                defaultValue={browseDir ?? ''}
                onBlur={(e) => setBrowseDir(e.target.value.trim() || null)}
                placeholder={t('sections.backup.local.pathPlaceholder')}
                data-testid="local-backup-browse-input"
                className="mt-1 h-8 w-full rounded-[10px] bg-field px-3 text-[13px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
              />
            </div>
          )}

          {/* Local backup list, always shown so the card keeps its height */}
          <div className="mt-4">
            {browseDir && (
              <div
                className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20"
                data-testid="local-backup-browsing-banner"
              >
                <FolderSearch
                  strokeWidth={1.5}
                  className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <span className="min-w-0 flex-1 truncate text-xs text-amber-800 dark:text-amber-200">
                  {t('sections.backup.local.restoreFrom.browsing', {
                    path: browseDir,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setBrowseDir(null)}
                  title={t('sections.backup.local.restoreFrom.stopBrowsing')}
                  className="shrink-0 rounded-md p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                >
                  <X strokeWidth={1.75} className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-fg-label">
                {t('sections.backup.local.listTitle')}
              </span>
              <button
                type="button"
                onClick={() => local.refetch()}
                disabled={!(hasPath || browseDir) || local.isFetching}
                title={t('sections.backup.list.refresh')}
                className="rounded-lg p-1.5 text-fg-label hover:bg-hover hover:text-fg disabled:opacity-50"
              >
                <RefreshCw
                  strokeWidth={1.75}
                  className={`h-3.5 w-3.5 ${local.isFetching ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            <div
              className="h-40 overflow-y-auto"
              data-testid="local-backup-list"
            >
              {isLoading || local.isLoading ? (
                <p className="text-xs text-fg-hint">
                  {t('sections.backup.list.loading')}
                </p>
              ) : !(hasPath || browseDir) ? (
                <p className="text-xs text-fg-hint">
                  {t('sections.backup.local.noFolder')}
                </p>
              ) : local.backups.length === 0 ? (
                <p className="text-xs text-fg-hint">
                  {t('sections.backup.local.empty')}
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {local.backups.map((file) => (
                    <li
                      key={file.name}
                      data-testid="local-backup-row"
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-fg-body">
                          {formatDate(file.createdAtMs)}
                          {file.appVersion ? ` · v${file.appVersion}` : ''}
                        </p>
                        <p className="truncate text-xs text-fg-hint">
                          {formatBytes(file.sizeBytes)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPendingRestore(file)}
                          title={t('sections.backup.local.restoreFrom.restore')}
                          data-testid="local-backup-restore"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
                        >
                          <RotateCcw strokeWidth={1.5} className="h-4 w-4" />
                        </button>
                        {/* Deleting is scoped to the configured folder, so it is
                            hidden while browsing someone else's. */}
                        {!browseDir && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(file)}
                            title={t('sections.backup.list.delete')}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Removing the folder stops local backups: confirmed, never one click */}
      {pendingClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !local.isSettingPath && setPendingClear(false)}
            onKeyDown={(e) => e.key === 'Escape' && setPendingClear(false)}
          />
          <div
            className="relative mx-4 w-full max-w-md rounded-xl border border-line bg-panel shadow-popover p-5"
            role="dialog"
            data-testid="local-backup-clear-dialog"
          >
            <h3 className="text-base font-semibold text-fg">
              {t('sections.backup.local.clearModal.title')}
            </h3>
            <p className="mt-2 text-[13px] text-fg-label">
              {t('sections.backup.local.clearModal.message')}
            </p>
            <p className="mt-2 break-all text-xs text-fg-hint">
              {localBackupPath}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingClear(false)}
                disabled={local.isSettingPath}
                className="h-8 rounded-lg bg-field px-3 text-[13px] font-medium text-fg hover:bg-hover disabled:opacity-50"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                disabled={local.isSettingPath}
                data-testid="local-backup-clear-confirm"
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-red-600 px-3 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {local.isSettingPath && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t('sections.backup.local.clearModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore confirmation — destructive, so it names the file and warns */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !local.isRestoring && setPendingRestore(null)}
            onKeyDown={(e) => e.key === 'Escape' && setPendingRestore(null)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-line bg-panel shadow-popover p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                strokeWidth={1.5}
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-fg">
                  {t('sections.backup.local.restoreModal.title')}
                </h3>
                <p className="mt-2 text-[13px] text-fg-label">
                  {t('sections.backup.local.restoreModal.message', {
                    date: formatDate(pendingRestore.createdAtMs),
                  })}
                </p>
                <p className="mt-2 break-all text-xs text-fg-hint">
                  {pendingRestore.path}
                </p>
                <p className="mt-2 text-[13px] font-medium text-amber-700 dark:text-amber-400">
                  {t('sections.backup.local.restoreModal.warning')}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={local.isRestoring}
                className="h-8 rounded-lg bg-field px-3 text-[13px] font-medium text-fg hover:bg-hover disabled:opacity-50"
              >
                {t('sections.backup.local.restoreModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleRestoreConfirm}
                disabled={local.isRestoring}
                data-testid="local-backup-restore-confirm"
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-amber-600 px-3 text-[13px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {local.isRestoring && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {local.isRestoring
                  ? t('sections.backup.local.restoreModal.restoring')
                  : t('sections.backup.local.restoreModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPendingDelete(null)}
            onKeyDown={(e) => e.key === 'Escape' && setPendingDelete(null)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-line bg-panel shadow-popover p-5">
            <h3 className="text-base font-semibold text-fg">
              {t('sections.backup.deleteModal.title')}
            </h3>
            <p className="mt-2 text-[13px] text-fg-label">
              {t('sections.backup.deleteModal.message')}
            </p>
            <p className="mt-2 break-all text-xs text-fg-hint">
              {pendingDelete.path}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={local.isDeleting}
                className="h-8 rounded-lg bg-field px-3 text-[13px] font-medium text-fg hover:bg-hover disabled:opacity-50"
              >
                {t('sections.backup.deleteModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={local.isDeleting}
                data-testid="local-backup-delete-confirm"
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-red-600 px-3 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {local.isDeleting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
