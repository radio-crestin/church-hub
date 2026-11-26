import { Heart } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { SettingsSection } from '../../settings'

const linkClass = 'text-focus hover:underline'

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
        className="p-4 border border-line rounded-xl"
      >
        <p className="text-[13px] font-medium text-fg">
          {t('sections.credits.bibleTopics.title')}
        </p>
        <p className="text-[13px] text-fg-label mt-1">
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
