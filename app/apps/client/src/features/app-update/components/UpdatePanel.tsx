import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  parseReleaseBody,
  useReleaseNotes,
  VersionNotesCard,
} from '~/features/release-notes'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { useUpdateDownload } from '../hooks/useUpdateDownload'

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
    dismissError,
    install,
  } = useUpdateDownload()

  // A failure stays on screen while the operator is here, and is cleared once
  // they leave — so it is seen once, not again on every later visit.
  const hasErrorRef = useRef(false)
  hasErrorRef.current = !!error
  useEffect(
    () => () => {
      if (hasErrorRef.current) dismissError()
    },
    [dismissError],
  )

  // The same structured notes the release-notes history renders, so a new
  // version reads exactly like every past one instead of raw markdown. The
  // history comes from its own request to GitHub; when that one has not landed
  // (or was rate-limited) the release notes the update check already fetched
  // are parsed the same way, so the notes never fall back to "nothing here".
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

  const canDownload = !!updateInfo?.installable

  return (
    <div className="space-y-4" data-testid="update-panel">
      {/* Version + check */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-base font-bold text-gray-900 dark:text-white"
                data-testid="update-current-version"
              >
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
                    {formatBytes(state.receivedBytes)}
                    {state.totalBytes
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
              {isReady || isInstalling ? (
                <button
                  type="button"
                  onClick={() => void install()}
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
                  disabled={isDownloading}
                  data-testid="update-download"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {isDownloading ? (
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

      {/* How it works — so the restart does not come as a surprise */}
      <p
        className="text-xs text-gray-500 dark:text-gray-400"
        data-testid="update-how-it-works"
      >
        {t('sections.updates.howItWorks')}
      </p>
    </div>
  )
}
