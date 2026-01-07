import { Download, ExternalLink, Info, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppUpdate } from '../hooks/useAppUpdate'

export function AboutSection() {
  const { t } = useTranslation('settings')
  const { updateInfo, isLoading, isDownloading, checkNow, downloadUpdate } =
    useAppUpdate()

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('sections.about.title')}
        </h3>
      </div>

      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
        {t('sections.about.description')}
      </p>

      <div className="space-y-4">
        {/* Current Version */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t('sections.about.currentVersion')}
            </p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              v{updateInfo?.currentVersion || '...'}
            </p>
          </div>
          <button
            onClick={() => void checkNow()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title={t('sections.about.checkForUpdates')}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            {t('sections.about.checkForUpdates')}
          </button>
        </div>

        {/* Latest Version / Update Available */}
        {updateInfo?.hasUpdate ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {t('sections.about.updateAvailable')}
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  v{updateInfo.latestVersion}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  {t('sections.about.updateDescription')}
                </p>
              </div>
              <button
                onClick={() => void downloadUpdate()}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Download size={16} />
                {isDownloading
                  ? t('sections.about.downloading')
                  : t('sections.about.downloadUpdate')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('sections.about.upToDate')}
            </p>
          </div>
        )}

        {/* Release Notes Link */}
        {updateInfo?.releaseUrl && (
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ExternalLink size={14} />
            {t('sections.about.viewReleaseNotes')}
          </a>
        )}
      </div>
    </div>
  )
}
