import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppUpdate } from '../hooks/useAppUpdate'

interface VersionDisplayProps {
  isCollapsed: boolean
}

export function VersionDisplay({ isCollapsed }: VersionDisplayProps) {
  const { t } = useTranslation('sidebar')
  const { updateInfo, isLoading, checkNow } = useAppUpdate()

  if (!updateInfo) {
    return null
  }

  const { currentVersion, latestVersion, hasUpdate } = updateInfo

  return (
    <div
      className={`flex items-center text-xs text-gray-500 dark:text-gray-400 ${
        isCollapsed ? 'justify-center' : 'justify-between'
      }`}
    >
      <div
        className={`flex items-center gap-1 ${isCollapsed ? 'flex-col' : ''}`}
      >
        <span title={t('version.current')}>v{currentVersion}</span>
        {!isCollapsed && hasUpdate && (
          <span className="text-green-600 dark:text-green-400">
            → v{latestVersion}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <button
          onClick={() => void checkNow()}
          disabled={isLoading}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          title={t('version.checkForUpdates')}
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  )
}
