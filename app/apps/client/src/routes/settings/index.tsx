import { createFileRoute } from '@tanstack/react-router'
import { Languages, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BibleTranslationSetting } from '~/features/bible/components'
import { DisplayManager } from '~/features/presentation'
import { SynonymManager } from '~/features/search'
import { SidebarConfigManager } from '~/features/sidebar-config'
import { ImportExportManager } from '~/features/song-export'
import { CategoryManager } from '~/features/songs/components'
import { UserList } from '~/features/users'
import { useI18n } from '~/provider/i18n-provider'
import { useTheme } from '~/provider/theme-provider'
import type { LanguagePreference } from '~/service/locale'
import type { ThemePreference } from '~/service/theme'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation('settings')
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

  const handleLanguageChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newPreference = e.target.value as LanguagePreference
    await setLanguagePreference(newPreference)
  }

  const handleThemeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPreference = e.target.value as ThemePreference
    await setThemePreference(newPreference)
  }

  return (
    <PagePermissionGuard permission="settings.view">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('sections.application.description')}
          </p>
        </div>

        {/* Appearance Settings Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('sections.appearance.title')}
            </h3>

            {/* Language Setting */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('sections.language.title')}
                </label>
              </div>
              <select
                value={languagePreference}
                onChange={handleLanguageChange}
                disabled={isLanguageLoading}
                className="block w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 dark:placeholder:text-gray-400"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-gray-600 dark:text-gray-400 text-xs">
                {t('sections.language.description')}
              </p>
            </div>

            {/* Theme Setting */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('sections.theme.title')}
                </label>
              </div>
              <select
                value={themePreference}
                onChange={handleThemeChange}
                disabled={isThemeLoading}
                className="block w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 dark:placeholder:text-gray-400"
              >
                {themeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-gray-600 dark:text-gray-400 text-xs">
                {t('sections.theme.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Bible Settings Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <BibleTranslationSetting />
        </div>

        {/* Song Categories Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <CategoryManager />
        </div>

        {/* Import/Export Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <ImportExportManager />
        </div>

        {/* Search Synonyms Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <SynonymManager />
        </div>

        {/* Authorized Users Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <UserList />
        </div>

        {/* Displays Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <DisplayManager />
        </div>

        {/* Sidebar Configuration Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <SidebarConfigManager />
        </div>
      </div>
    </PagePermissionGuard>
  )
}
