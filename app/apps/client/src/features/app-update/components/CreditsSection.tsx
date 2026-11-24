import { Heart } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { SettingsSection } from '../../settings'

const linkClass = 'text-indigo-600 dark:text-indigo-400 hover:underline'

/** The data the app bundles from others, with its licence and attribution. */
export function CreditsSection() {
  const { t } = useTranslation('settings')

  return (
    <SettingsSection
      title={t('sections.credits.title')}
      description={t('sections.credits.description')}
      icon={Heart}
    >
      <div
        data-testid="credits-bible-topics"
        className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
      >
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {t('sections.credits.bibleTopics.title')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          <Trans
            t={t}
            i18nKey="sections.credits.bibleTopics.attribution"
            components={{
              source: (
                <a
                  href="https://www.openbible.info/topics/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                />
              ),
              licence: (
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                />
              ),
            }}
          />
        </p>
      </div>
    </SettingsSection>
  )
}
