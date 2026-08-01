import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isTauri } from '~/utils/isTauri'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { useUpdateDownload } from '../hooks/useUpdateDownload'

interface UpdateNotificationProps {
  isCollapsed: boolean
}

/**
 * The sidebar's "a new version is waiting" badge.
 *
 * It opens the update page rather than GitHub: everything an operator needs —
 * the changelog, the download, the install — lives in the app now, and being
 * dropped into a browser was the reason updates never got applied.
 *
 * It also stays visible once the installer has been downloaded but not yet
 * run, which is exactly the moment the reminder matters most.
 */
export function UpdateNotification({ isCollapsed }: UpdateNotificationProps) {
  const { t } = useTranslation('sidebar')
  const navigate = useNavigate()
  const { updateInfo, isDismissed, dismissUpdate } = useAppUpdate()

  const { isReady, isDownloading, progress } = useUpdateDownload(
    updateInfo?.downloadUrl ?? null,
    updateInfo?.latestVersion ?? null,
  )

  // A dev instance never polls, so `hasUpdate` can only be true there after
  // the operator pressed "Check now" — at which point hiding the badge would
  // be hiding something they asked for.
  if (!isTauri() || !updateInfo?.hasUpdate) return null
  // A downloaded-but-uninstalled update outranks dismissal: the operator asked
  // for it, so it stays until it is actually applied.
  if (isDismissed && !isReady) return null

  const { latestVersion } = updateInfo
  const openUpdates = () => navigate({ to: '/settings/updates' })

  const label = isReady
    ? t('version.readyToInstall', { version: latestVersion })
    : t('version.updateAvailable', { version: latestVersion })

  if (isCollapsed) {
    return (
      <div className="flex justify-center mb-2">
        <button
          type="button"
          onClick={openUpdates}
          data-testid="sidebar-update-badge"
          className="relative p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          title={label}
        >
          {isReady ? <CheckCircle2 size={16} /> : <Download size={16} />}
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </button>
      </div>
    )
  }

  return (
    <div className="mb-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {label}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            {isReady
              ? t('version.clickToInstall')
              : t('version.clickToOpenUpdates')}
          </p>
        </div>
        {!isReady && (
          <button
            type="button"
            onClick={dismissUpdate}
            className="p-1 rounded hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors text-green-600 dark:text-green-400"
            title={t('version.dismiss')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* A download started from the page keeps reporting here, so switching
          away from it does not hide the fact that something is in flight. */}
      {isDownloading && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-green-200 dark:bg-green-800">
          <div
            className="h-full rounded-full bg-green-600 transition-[width] duration-200 dark:bg-green-400"
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={openUpdates}
        data-testid="sidebar-update-badge"
        className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
      >
        {isReady ? <CheckCircle2 size={14} /> : <Download size={14} />}
        {isReady ? t('version.install') : t('version.viewUpdate')}
      </button>
    </div>
  )
}
