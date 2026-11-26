import { useTranslation } from 'react-i18next'

import { useI18n } from '~/provider/i18n-provider'
import { useTheme } from '~/provider/theme-provider'
import type { LanguagePreference } from '~/service/locale'
import type { ThemePreference } from '~/service/theme'
import { ChoiceGroup } from './ChoiceGroup'

/** First step: a welcome, the language and the theme. */
export function WelcomeStep() {
  const { t } = useTranslation(['onboarding', 'settings'])
  const { preference: language, setLanguagePreference } = useI18n()
  const { preference: theme, setThemePreference } = useTheme()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-fg">{t('welcome.title')}</h1>
        <p className="text-sm text-fg-label">{t('welcome.description')}</p>
      </div>
      <ChoiceGroup<LanguagePreference>
        label={t('welcome.language')}
        value={language}
        onChange={setLanguagePreference}
        options={[
          { value: 'ro', label: 'Română' },
          { value: 'en', label: 'English' },
          {
            value: 'system',
            label: t('settings:sections.language.options.system'),
          },
        ]}
      />
      <ChoiceGroup<ThemePreference>
        label={t('welcome.theme')}
        value={theme}
        onChange={setThemePreference}
        options={[
          { value: 'light', label: t('settings:sections.theme.options.light') },
          { value: 'dark', label: t('settings:sections.theme.options.dark') },
          {
            value: 'system',
            label: t('settings:sections.theme.options.system'),
          },
        ]}
      />
    </div>
  )
}
