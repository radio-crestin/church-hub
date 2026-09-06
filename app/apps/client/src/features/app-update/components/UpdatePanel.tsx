import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  parseReleaseBody,
  useReleaseNotes,
  VersionNotesCard,
} from '~/features/release-notes'
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
    errorCode,
    startDownload,
    isStarting,
    dismissError,
    install,
  } = useUpdateDownload(updateInfo?.downloadUrl ?? null, version)

  // A failure stays on screen while the operator is here, and is cleared once
  // they leave — so it is seen once, not again on every later visit.
  const hasErrorRef = useRef(false)
  hasErrorRef.current = !!error
  useEffect(
    () => () => {
      if (hasErrorRef.current) void dismissError()
    },
    [dismissError],
  )

  // The same structured notes the release-notes history renders, so a new
  // version reads exactly like every past one instead of raw markdown. The
  // history comes from its own request to GitHub; when that one has not landed
  // (or was rate-limited) the release body the update check already fetched is
  // parsed the same way, so the notes never fall back to "nothing here".
  const { data: notes } = useReleaseNotes()
  const versionNotes = useMemo(() => {
    if (!version || !updateInfo) return null
    const listed = notes?.find((entry) => entry.version === version)
    if (listed) return listed
    return parseReleaseBody(
      version,
      updateInfo.publishedAt || null,
      updateInfo.releaseNotes,
    )
  }, [notes, version, updateInfo])

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

      {/* What's new — the same card the release-notes history uses */}
      {hasUpdate && versionNotes && (
        <div data-testid="update-available">
          <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            {t('sections.updates.whatsNew', { version })}
          </h4>

          <VersionNotesCard
            notes={versionNotes}
            variant="available"
            data-testid="update-version-notes"
          >
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
              <div
                role="alert"
                data-testid="update-error"
                className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-900/20"
              >
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {t(
                    `sections.updates.available.errors.${errorCode ?? 'unknown'}`,
                  )}
                </p>
                <p className="mt-0.5 break-all font-mono text-xs text-red-600/80 dark:text-red-400/80">
                  {error}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {isReady ? (
                <button
                  type="button"
                  onClick={() => {
                    const labels = {
                      title: t('sections.updates.installer.title'),
                      closing: t('sections.updates.installer.closing'),
                      installing: t('sections.updates.installer.installing', {
                        version,
                      }),
                      launching: t('sections.updates.installer.launching'),
                      hint: t('sections.updates.installer.hint'),
                      failed: t('sections.updates.installer.failed', {
                        // Left for the installer to fill in.
                        reason: '{{reason}}',
                        interpolation: { escapeValue: false },
                      }),
                      openManually: t(
                        'sections.updates.installer.openManually',
                      ),
                    }
                    void install(labels).then((result) => {
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
              ) : !canDownload ? (
                /* A disabled button with only a tooltip left the operator with
                   no idea why nothing happened. Say it outright. */
                <p
                  className="text-sm text-amber-700 dark:text-amber-400"
                  data-testid="update-unavailable"
                >
                  {t('sections.updates.available.unavailable')}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void startDownload()}
                  disabled={isDownloading || isStarting}
                  data-testid="update-download"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {isDownloading || isStarting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {error
                    ? t('sections.updates.available.retry')
                    : t('sections.updates.available.download')}
                </button>
              )}

              <a
                href={updateInfo?.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <ExternalLink size={12} />
                {t('sections.updates.available.openRelease')}
              </a>
            </div>
          </VersionNotesCard>
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
