import { Link } from '@tanstack/react-router'
import { Download, ExternalLink, Info, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isWebApp } from '~/config'
import { CreditsSection } from './CreditsSection'
import { ReleaseNotesSection } from '../../release-notes'
import { SettingsSection } from '../../settings'
import { useAppUpdate } from '../hooks/useAppUpdate'

export function AboutSection() {
  const { t } = useTranslation('settings')
  const { updateInfo, isLoading, isDevInstance, checkNow } = useAppUpdate()

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title={t('sections.about.title')}
        description={t('sections.about.description')}
        icon={Info}
      >
        <div className="space-y-4">
          {/* Current Version */}
          <div className="flex items-center justify-between p-4 border border-line rounded-xl">
            <div>
              <p className="text-sm font-medium text-fg">
                {t('sections.about.currentVersion')}
              </p>
              <p className="text-xl font-semibold tabular-nums text-fg mt-1">
                v{updateInfo?.currentVersion || '...'}
              </p>
            </div>
            {!isDevInstance && !isWebApp && (
              <button
                onClick={() => void checkNow()}
                disabled={isLoading}
                className="flex h-8 items-center gap-2 px-3 text-sm font-medium bg-field text-fg hover:bg-hover rounded-lg transition-colors disabled:opacity-50"
                title={t('sections.about.checkForUpdates')}
              >
                <RefreshCw
                  size={16}
                  strokeWidth={1.5}
                  className={isLoading ? 'animate-spin' : ''}
                />
                {t('sections.about.checkForUpdates')}
              </button>
            )}
          </div>

          {/* Dev instance note / Latest Version / Update Available */}
          {isDevInstance ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t('sections.about.devInstance')}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                {t('sections.about.devInstanceDescription')}
              </p>
            </div>
          ) : updateInfo?.hasUpdate ? (
            <div className="p-4 border border-line rounded-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-fg">
                    {t('sections.about.updateAvailable')}
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-fg mt-1">
                    v{updateInfo.latestVersion}
                  </p>
                  <p className="text-xs text-fg-hint mt-2">
                    {t('sections.about.updateDescription')}
                  </p>
                </div>
                {/* The whole flow — notes, download, install — lives on the
                    updates page; sending people to a browser download is how
                    updates used to go unapplied. */}
                <Link
                  to="/settings/updates"
                  data-testid="about-open-updates"
                  className="flex h-9 items-center gap-2 px-3.5 bg-primary hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <Download size={16} strokeWidth={1.5} />
                  {t('sections.about.openUpdates')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 border border-line rounded-xl">
              <p className="text-sm text-fg-label">
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
              className="flex items-center gap-2 text-sm text-focus hover:underline"
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              {t('sections.about.viewReleaseNotes')}
            </a>
          )}
        </div>
      </SettingsSection>

      <ReleaseNotesSection currentVersion={updateInfo?.currentVersion} />

      <CreditsSection />
    </div>
  )
}
