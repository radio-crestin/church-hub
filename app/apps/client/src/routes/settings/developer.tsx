import { createFileRoute } from '@tanstack/react-router'
import { Bug, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getServerPort, isLocalhost } from '~/config'
import {
  DatabaseManager,
  FactoryReset,
  SearchIndexRebuild,
} from '~/features/database-management'
import { OpenLogsFolder } from '~/features/logs'
import { SecretStoreResetNotice } from '~/features/secret-store'
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
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bug strokeWidth={1.5} className="h-4 w-4 text-fg-label" />
                  <div>
                    <h4 className="text-sm font-medium text-fg">
                      {t('sections.debug.title')}
                    </h4>
                    <p className="mt-0.5 text-xs text-fg-hint">
                      {t('sections.debug.description')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDebugMode(!isDebugMode)}
                  disabled={isDebugLoading}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    isDebugMode ? 'bg-primary' : 'bg-line-strong'
                  } ${isDebugLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white ring-0 transition duration-200 ease-in-out ${
                      isDebugMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* API Documentation Card */}
            <div className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ExternalLink
                    strokeWidth={1.5}
                    className="h-4 w-4 text-fg-label"
                  />
                  <div>
                    <h4 className="text-sm font-medium text-fg">
                      {t('sections.apiDocs.title')}
                    </h4>
                    <p className="mt-0.5 text-xs text-fg-hint">
                      {t('sections.apiDocs.description')}
                    </p>
                  </div>
                </div>
                <a
                  href={`http://localhost:${getServerPort()}/api/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-indigo-700"
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

          {/* After importing a database from another computer: what to set up again */}
          {isLocalhost() && <SecretStoreResetNotice />}

          {/* Database Management (localhost only) */}
          {isLocalhost() && <DatabaseManager />}

          {/* Factory Reset (localhost only) */}
          {isLocalhost() && <FactoryReset />}
        </div>
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
