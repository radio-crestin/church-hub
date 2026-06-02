import { createFileRoute } from '@tanstack/react-router'
import { Languages, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SettingsSection } from '~/features/settings'
import { useI18n } from '~/provider/i18n-provider'
import { usePermissions } from '~/provider/permissions-provider'
import { useTheme } from '~/provider/theme-provider'
import type { LanguagePreference } from '~/service/locale'
import type { ThemePreference } from '~/service/theme'
import { Combobox } from '~/ui/combobox'

export const Route = createFileRoute('/settings/appearance')({
  component: AppearanceSettings,
})

function AppearanceSettings() {
  const { t } = useTranslation('settings')
  const { hasPermission } = usePermissions()
  // Appearance can be changed with full edit OR the granular appearance
  // permission; without either, the controls are shown read-only.
  const canEditAppearance =
    hasPermission('settings.edit') || hasPermission('settings.edit_appearance')

  const {
    preference: languagePreference,
    setLanguagePreference,
    isLoading: isLanguageLoading,
  } = useI18n()
  const {
    preference: themePreference,
    setThemePreference,
    isLoading: isThemeLoading,
  } = useTheme()

  const languageOptions: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: t('sections.language.options.system') },
    { value: 'en', label: t('sections.language.options.english') },
    { value: 'ro', label: t('sections.language.options.romanian') },
  ]

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('sections.theme.options.system') },
    { value: 'light', label: t('sections.theme.options.light') },
    { value: 'dark', label: t('sections.theme.options.dark') },
  ]

  return (
    <SettingsSection title={t('sections.appearance.title')}>
      {/* Language */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.language.title')}
          </label>
        </div>
        <Combobox
          options={languageOptions}
          value={languagePreference}
          onChange={(val) => setLanguagePreference(val as LanguagePreference)}
          disabled={isLanguageLoading || !canEditAppearance}
          allowClear={false}
        />
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('sections.language.description')}
        </p>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.theme.title')}
          </label>
        </div>
        <Combobox
          options={themeOptions}
          value={themePreference}
          onChange={(val) => setThemePreference(val as ThemePreference)}
          disabled={isThemeLoading || !canEditAppearance}
          allowClear={false}
        />
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('sections.theme.description')}
        </p>
      </div>
    </SettingsSection>
  )
}
