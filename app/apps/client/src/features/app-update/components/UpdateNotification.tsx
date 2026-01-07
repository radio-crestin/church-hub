import { Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppUpdate } from '../hooks/useAppUpdate'

interface UpdateNotificationProps {
  isCollapsed: boolean
}

export function UpdateNotification({ isCollapsed }: UpdateNotificationProps) {
  const { t } = useTranslation('sidebar')
  const {
    updateInfo,
    isDismissed,
    isDownloading,
    dismissUpdate,
    downloadUpdate,
  } = useAppUpdate()

  // Don't show if no update, dismissed, or collapsed
  if (!updateInfo?.hasUpdate || isDismissed) {
    return null
  }

  const { latestVersion } = updateInfo

  if (isCollapsed) {
    // Collapsed view - just show a dot indicator
    return (
      <div className="flex justify-center mb-2">
        <button
          onClick={() => void downloadUpdate()}
          className="relative p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          title={t('version.updateAvailable', { version: latestVersion })}
        >
          <Download size={16} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </button>
      </div>
    )
  }

  // Expanded view - full notification
  return (
    <div className="mb-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {t('version.updateAvailable', { version: latestVersion })}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            {t('version.clickToDownload')}
          </p>
        </div>
        <button
          onClick={dismissUpdate}
          className="p-1 rounded hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors text-green-600 dark:text-green-400"
          title={t('version.dismiss')}
        >
          <X size={14} />
        </button>
      </div>
      <button
        onClick={() => void downloadUpdate()}
        disabled={isDownloading}
        className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {isDownloading ? t('version.downloading') : t('version.download')}
      </button>
    </div>
  )
}
