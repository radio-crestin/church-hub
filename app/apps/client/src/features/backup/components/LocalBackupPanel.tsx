import {
  FolderOpen,
  HardDriveDownload,
  Loader2,
  RefreshCw,
  Trash2,
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
}

/**
 * On-disk backups: pick a folder, back up into it on demand, and manage what's
 * there.
 *
 * Rendered above the Drive card and outside its "not connected" early return —
 * a local copy needs no Google account, and it is the only backup an operator
 * without one can make. Once a folder is set, the auto-backup scheduler writes
 * here too, before it touches Drive.
 */
export function LocalBackupPanel({
  localBackupPath,
  lastLocalBackupAt,
}: LocalBackupPanelProps) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const hasPath = !!localBackupPath
  const local = useLocalBackup(hasPath)
  const [pendingDelete, setPendingDelete] = useState<LocalBackupFile | null>(
    null,
  )
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
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
      data-testid="local-backup-panel"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
          <HardDriveDownload className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.backup.local.title')}
          </h4>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t('sections.backup.local.description')}
          </p>

          {/* Folder configuration */}
          <div className="mt-3">
            <span className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('sections.backup.local.folderLabel')}
            </span>
            {isTauri() ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code
                  className="min-w-0 flex-1 truncate rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  title={localBackupPath ?? undefined}
                  data-testid="local-backup-path"
                >
                  {localBackupPath ?? t('sections.backup.local.noFolder')}
                </code>
                <button
                  type="button"
                  onClick={handleChooseFolder}
                  disabled={local.isSettingPath}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <FolderOpen className="h-4 w-4" />
                  {t('sections.backup.local.chooseFolder')}
                </button>
                {hasPath && (
                  <button
                    type="button"
                    onClick={() => savePath(null)}
                    disabled={local.isSettingPath}
                    className="shrink-0 rounded-md px-2 py-2 text-xs text-gray-500 hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    {t('sections.backup.local.clearFolder')}
                  </button>
                )}
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
                  data-testid="local-backup-path-input"
                  className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            )}
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
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
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {local.isBackingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDriveDownload className="h-4 w-4" />
              )}
              {local.isBackingUp
                ? t('sections.backup.local.backingUp')
                : t('sections.backup.local.button')}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('sections.backup.local.lastBackup')}:{' '}
              {formatDate(lastLocalBackupAt ?? 0)}
            </span>
          </div>

          {/* Local backup list */}
          {hasPath && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t('sections.backup.local.listTitle')}
                </span>
                <button
                  type="button"
                  onClick={() => local.refetch()}
                  disabled={local.isFetching}
                  title={t('sections.backup.list.refresh')}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${local.isFetching ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
              {local.isLoading ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('sections.backup.list.loading')}
                </p>
              ) : local.backups.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('sections.backup.local.empty')}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                  {local.backups.map((file) => (
                    <li
                      key={file.name}
                      data-testid="local-backup-row"
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-gray-700 dark:text-gray-300">
                          {formatDate(file.createdAtMs)}
                          {file.appVersion ? ` · v${file.appVersion}` : ''}
                        </p>
                        <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                          {formatBytes(file.sizeBytes)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(file)}
                        title={t('sections.backup.list.delete')}
                        className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPendingDelete(null)}
            onKeyDown={(e) => e.key === 'Escape' && setPendingDelete(null)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('sections.backup.deleteModal.title')}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t('sections.backup.deleteModal.message')}
            </p>
            <p className="mt-2 break-all text-xs text-gray-400 dark:text-gray-500">
              {pendingDelete.path}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={local.isDeleting}
                className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('sections.backup.deleteModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={local.isDeleting}
                data-testid="local-backup-delete-confirm"
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
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
