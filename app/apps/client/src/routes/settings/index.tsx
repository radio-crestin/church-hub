import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, Languages, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isLocalhost } from '~/config'
import {
  MIDIProvider,
  ShortcutsSettingsSection,
} from '~/features/keyboard-shortcuts'
import { ScreenManager } from '~/features/presentation'
import { SidebarConfigManager } from '~/features/sidebar-config'
import { SystemTokenManager } from '~/features/system-token'
import { UserList } from '~/features/users'
import { useI18n } from '~/provider/i18n-provider'
import { useTheme } from '~/provider/theme-provider'
import type { LanguagePreference } from '~/service/locale'
import type { ThemePreference } from '~/service/theme'
import { Combobox } from '~/ui/combobox'
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
              <Combobox
                options={languageOptions}
                value={languagePreference}
                onChange={(val) =>
                  setLanguagePreference(val as LanguagePreference)
                }
                disabled={isLanguageLoading}
                allowClear={false}
              />
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
              <Combobox
                options={themeOptions}
                value={themePreference}
                onChange={(val) => setThemePreference(val as ThemePreference)}
                disabled={isThemeLoading}
                allowClear={false}
              />
              <p className="text-gray-600 dark:text-gray-400 text-xs">
                {t('sections.theme.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Screens Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <ScreenManager />
        </div>

        {/* Sidebar Configuration Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <SidebarConfigManager />
        </div>

        {/* Authorized Users Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <UserList />
        </div>

        {/* Keyboard Shortcuts Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <MIDIProvider>
            <ShortcutsSettingsSection />
          </MIDIProvider>
        </div>

        {/* API & Developer Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 space-y-6">
          {/* API Documentation Link */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('sections.apiDocs.title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                {t('sections.apiDocs.description')}
              </p>
            </div>
            <a
              href="http://localhost:3000/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {t('sections.apiDocs.link')}
            </a>
          </div>

          {/* System Token (localhost only) */}
          {isLocalhost() && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <SystemTokenManager />
            </>
          )}
        </div>
      </div>
    </PagePermissionGuard>
  )
}
