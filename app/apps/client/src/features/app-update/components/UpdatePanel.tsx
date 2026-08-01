import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bug,
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ChangeCategoryList, useReleaseNotes } from '~/features/release-notes'
import { useToast } from '~/ui/toast'
import { isTauri } from '~/utils/isTauri'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { useUpdateDownload } from '../hooks/useUpdateDownload'
import {
  getUpdateConfig,
  setUpdateDownloadDir,
} from '../services/updateDownloadService'

const CONFIG_KEY = ['app-update', 'config']

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * The update page: what the new version brings, then download and install it.
 *
 * This is deliberately a page rather than a modal. An update is something an
 * operator reads through — a changelog, a download, an install — and a dialog
 * that opens itself over the app interrupts whatever they were doing to make
 * them dismiss it. The sidebar badge links here instead.
 */
export function UpdatePanel() {
  const { t } = useTranslation('settings')
  const { t: tNotes } = useTranslation('releaseNotes')
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { updateInfo, isLoading, checkNow } = useAppUpdate()

  const version = updateInfo?.latestVersion ?? null
  const hasUpdate = !!updateInfo?.hasUpdate

  const {
    state,
    progress,
    isDownloading,
    isReady,
    isInstalling,
    error,
    startDownload,
    isStarting,
    install,
  } = useUpdateDownload(updateInfo?.downloadUrl ?? null, version)

  // The same structured notes the release-notes history renders, so a new
  // version reads exactly like every past one instead of raw markdown.
  const { data: notes } = useReleaseNotes()
  const versionNotes = useMemo(
    () => notes?.find((entry) => entry.version === version) ?? null,
    [notes, version],
  )

  const configQuery = useQuery({
    queryKey: CONFIG_KEY,
    queryFn: getUpdateConfig,
  })
  const config = configQuery.data

  const setDir = useMutation({
    mutationFn: setUpdateDownloadDir,
    onSuccess: (next) => {
      queryClient.setQueryData(CONFIG_KEY, next)
      showToast(t('sections.updates.folder.saved'), 'success')
    },
    onError: () => showToast(t('sections.updates.folder.failed'), 'error'),
  })

  const handleChooseFolder = useCallback(async () => {
    if (!isTauri()) return
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('sections.updates.folder.choose'),
      defaultPath: config?.effectiveDownloadDir,
    })
    if (typeof selected === 'string' && selected) {
      await setDir.mutateAsync(selected)
    }
  }, [config?.effectiveDownloadDir, setDir, t])

  const canDownload = isTauri() && !!updateInfo?.downloadUrl
  const isEmptyNotes =
    !!versionNotes &&
    versionNotes.features.length +
      versionNotes.bugFixes.length +
      versionNotes.changes.length ===
      0

  return (
    <div className="space-y-4" data-testid="update-panel">
      {/* Version + check */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-gray-900 dark:text-white">
                v{updateInfo?.currentVersion ?? '—'}
              </span>
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">
                {tNotes('current')}
              </span>
              {hasUpdate && (
                <>
                  <span className="text-gray-400">→</span>
                  <span
                    className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white"
                    data-testid="update-new-version"
                  >
                    v{version}
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {hasUpdate
                ? t('sections.updates.status.available', { version })
                : t('sections.updates.status.upToDate', {
                    version: updateInfo?.currentVersion ?? '',
                  })}
            </p>
          </div>

          <button
            type="button"
            onClick={checkNow}
            disabled={isLoading}
            data-testid="update-check-now"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {/* The spin is the whole feedback for this button — without it a
                check that finds nothing looks like a dead click. */}
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            {isLoading
              ? t('sections.updates.status.checking')
              : t('sections.updates.status.check')}
          </button>
        </div>
      </div>

      {/* What's new — same shape as the release-notes history */}
      {hasUpdate && (
        <div className="rounded-lg border border-green-200 bg-green-50/40 p-4 dark:border-green-800 dark:bg-green-900/10">
          <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            {t('sections.updates.whatsNew', { version })}
          </h4>

          {versionNotes && !isEmptyNotes ? (
            <div className="space-y-3">
              <ChangeCategoryList
                icon={Sparkles}
                label={tNotes('categories.features')}
                accentClassName="text-green-600 dark:text-green-400"
                entries={versionNotes.features}
              />
              <ChangeCategoryList
                icon={Bug}
                label={tNotes('categories.bugFixes')}
                accentClassName="text-red-600 dark:text-red-400"
                entries={versionNotes.bugFixes}
              />
              <ChangeCategoryList
                icon={Wrench}
                label={tNotes('categories.changes')}
                accentClassName="text-blue-600 dark:text-blue-400"
                entries={versionNotes.changes}
              />
            </div>
          ) : (
            <p className="text-sm italic text-gray-500 dark:text-gray-400">
              {tNotes('empty')}
            </p>
          )}

          {/* Download / progress / install */}
          <div className="mt-4 border-t border-green-200 pt-4 dark:border-green-800">
            {(isDownloading || isReady || isInstalling) && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>
                    {isInstalling
                      ? t('sections.updates.available.installing')
                      : isReady
                        ? t('sections.updates.available.readyToInstall')
                        : t('sections.updates.available.downloading')}
                  </span>
                  <span>
                    {progress !== null && isDownloading
                      ? `${progress}% · `
                      : ''}
                    {formatBytes(state?.receivedBytes ?? 0)}
                    {state?.totalBytes
                      ? ` / ${formatBytes(state.totalBytes)}`
                      : ''}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                  data-testid="update-progress"
                >
                  <div
                    className="h-full rounded-full bg-green-600 transition-[width] duration-200 dark:bg-green-500"
                    style={{
                      width: `${isReady || isInstalling ? 100 : (progress ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="mb-2 text-sm text-red-600 dark:text-red-400">
                {t('sections.updates.available.failed')}
              </p>
            )}

            {isReady ? (
              <button
                type="button"
                onClick={() => {
                  void install().then((result) => {
                    if (!result.success) {
                      showToast(
                        t('sections.updates.available.installFailed', {
                          reason: result.error ?? '',
                        }),
                        'error',
                      )
                    }
                  })
                }}
                disabled={isInstalling}
                data-testid="update-install"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {isInstalling ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {t('sections.updates.available.install')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startDownload()}
                disabled={!canDownload || isDownloading || isStarting}
                data-testid="update-download"
                title={
                  canDownload
                    ? undefined
                    : t('sections.updates.available.unavailable')
                }
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {isDownloading || isStarting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {t('sections.updates.available.download')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Download folder */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          {t('sections.updates.folder.title')}
        </h4>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {t('sections.updates.folder.description')}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300"
            title={config?.effectiveDownloadDir}
            data-testid="update-download-dir"
          >
            {config?.effectiveDownloadDir ?? '…'}
          </code>
          {isTauri() && (
            <button
              type="button"
              onClick={handleChooseFolder}
              disabled={setDir.isPending}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <FolderOpen className="h-4 w-4" />
              {t('sections.updates.folder.choose')}
            </button>
          )}
          {config?.downloadDir && (
            <button
              type="button"
              onClick={() => setDir.mutate(null)}
              disabled={setDir.isPending}
              className="shrink-0 rounded-md px-2 py-2 text-xs text-gray-500 hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400"
            >
              {t('sections.updates.folder.reset')}
            </button>
          )}
        </div>
        {!config?.downloadDir && (
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {t('sections.updates.folder.usingDefault')}
          </p>
        )}
      </div>
    </div>
  )
}
