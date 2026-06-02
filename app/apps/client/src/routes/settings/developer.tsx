import { createFileRoute } from '@tanstack/react-router'
import { Bug, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isLocalhost } from '~/config'
import {
  DatabaseManager,
  FactoryReset,
  SearchIndexRebuild,
} from '~/features/database-management'
import { OpenLogsFolder } from '~/features/logs'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'
import { SystemTokenManager } from '~/features/system-token'
import { useDebugMode } from '~/hooks/useDebugMode'

export const Route = createFileRoute('/settings/developer')({
  component: DeveloperSettings,
})

function DeveloperSettings() {
  const { t } = useTranslation('settings')
  const {
    isDebugMode,
    setDebugMode,
    isLoading: isDebugLoading,
  } = useDebugMode()

  return (
    <SettingsLeafGuard itemId="developer">
      <SettingsSection
        title={t('sections.developer.title')}
        description={t('sections.developer.description')}
      >
        <div className="space-y-6">
          {/* Debug Mode and API Docs Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Debug Mode Card */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bug className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('sections.debug.title')}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {t('sections.debug.description')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDebugMode(!isDebugMode)}
                  disabled={isDebugLoading}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                    isDebugMode
                      ? 'bg-indigo-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  } ${isDebugLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isDebugMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* API Documentation Card */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ExternalLink className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('sections.apiDocs.title')}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {t('sections.apiDocs.description')}
                    </p>
                  </div>
                </div>
                <a
                  href="http://localhost:3000/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                >
                  {t('sections.apiDocs.link')}
                </a>
              </div>
            </div>
          </div>

          {/* System Token (localhost only) */}
          {isLocalhost() && <SystemTokenManager />}

          {/* Search Index Rebuild (localhost only) */}
          {isLocalhost() && <SearchIndexRebuild />}

          {/* Open Logs Folder (localhost only — host file manager) */}
          {isLocalhost() && <OpenLogsFolder />}

          {/* Database Management (localhost only) */}
          {isLocalhost() && <DatabaseManager />}

          {/* Factory Reset (localhost only) */}
          {isLocalhost() && <FactoryReset />}
        </div>
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
