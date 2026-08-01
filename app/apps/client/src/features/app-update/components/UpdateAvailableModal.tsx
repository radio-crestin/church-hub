import {
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useReleaseNotes } from '~/features/release-notes'
import { isTauri } from '~/utils/isTauri'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { useUpdateDownload } from '../hooks/useUpdateDownload'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * The in-app "a new version is available" panel.
 *
 * Shows what changed, downloads the installer into the configured folder with a
 * progress bar, and installs it without any further interaction. If the
 * artifact is already in that folder from an earlier session the download step
 * is skipped and Install is offered straight away.
 */
export function UpdateAvailableModal() {
  const { t } = useTranslation('settings')
  const { updateInfo, isDismissed, isDevInstance, dismissUpdate } =
    useAppUpdate()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const hasUpdate = !!updateInfo?.hasUpdate && !isDismissed && !isDevInstance
  const version = updateInfo?.latestVersion ?? null

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

  // Prefer the structured changelog for this version; the release body is the
  // fallback when the notes have not been parsed for it.
  const { data: notes } = useReleaseNotes()
  const versionNotes = useMemo(
    () => notes?.find((entry) => entry.version === version) ?? null,
    [notes, version],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (hasUpdate && !dialog.open) dialog.showModal()
    if (!hasUpdate && dialog.open) dialog.close()
  }, [hasUpdate])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      // Escape postpones rather than closing silently, so the panel does not
      // reappear on the next poll.
      if (!isDownloading && !isInstalling) dismissUpdate()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [dismissUpdate, isDownloading, isInstalling])

  if (!hasUpdate) return null

  const canDownload = isTauri() && !!updateInfo?.downloadUrl

  return (
    <dialog
      ref={dialogRef}
      data-testid="update-available-modal"
      className="fixed inset-0 m-auto w-full max-w-lg p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('sections.updates.available.title', { version })}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('sections.updates.available.current', {
                  version: updateInfo?.currentVersion,
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissUpdate}
            disabled={isDownloading || isInstalling}
            title={t('sections.updates.available.later')}
            data-testid="update-modal-dismiss"
            className="rounded p-1 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* What changed */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {versionNotes ? (
            <div className="space-y-3">
              {(
                [
                  ['features', versionNotes.features],
                  ['bugFixes', versionNotes.bugFixes],
                  ['changes', versionNotes.changes],
                ] as const
              )
                .filter(([, entries]) => entries.length > 0)
                .map(([category, entries]) => (
                  <section key={category}>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t(`sections.updates.categories.${category}`)}
                    </h3>
                    <ul className="space-y-1">
                      {entries.map((entry, i) => (
                        <li
                          key={`${entry.message}-${i}`}
                          className="text-sm text-gray-700 dark:text-gray-300"
                        >
                          {entry.scope && (
                            <span className="mr-1 font-medium text-indigo-600 dark:text-indigo-400">
                              {entry.scope}:
                            </span>
                          )}
                          {entry.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            </div>
          ) : updateInfo?.releaseNotes ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300">
              {updateInfo.releaseNotes}
            </pre>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('sections.updates.available.noNotes')}
            </p>
          )}
        </div>

        {/* Progress */}
        {(isDownloading || isReady || isInstalling) && (
          <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {isInstalling
                  ? t('sections.updates.available.installing')
                  : isReady
                    ? t('sections.updates.available.readyToInstall')
                    : t('sections.updates.available.downloading')}
              </span>
              <span>
                {formatBytes(state?.receivedBytes ?? 0)}
                {state?.totalBytes ? ` / ${formatBytes(state.totalBytes)}` : ''}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              data-testid="update-progress"
            >
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] duration-200 dark:bg-indigo-500"
                style={{
                  width: `${isReady || isInstalling ? 100 : (progress ?? 0)}%`,
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="border-t border-gray-200 px-4 py-2 text-sm text-red-600 dark:border-gray-700 dark:text-red-400">
            {t('sections.updates.available.failed')}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            type="button"
            onClick={dismissUpdate}
            disabled={isDownloading || isInstalling}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t('sections.updates.available.later')}
          </button>

          {isReady ? (
            <button
              type="button"
              onClick={() => void install()}
              disabled={isInstalling}
              data-testid="update-install"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isDownloading || isStarting ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {t('sections.updates.available.download')}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
