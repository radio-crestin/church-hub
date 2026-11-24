import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { PagePermissionGuard } from '~/ui/PagePermissionGuard'
import { SettingsSidebar } from './SettingsSidebar'
import { setLastSettingsSection } from '../lastSection'

/**
 * The settings page shell: a left category accordion + a content pane (Outlet)
 * wrapped in one bordered card. Full height with each column scrolling
 * independently. Responsive master-detail — on mobile the index shows the
 * full-width category list and a leaf shows its panel with a back link.
 */
export function SettingsLayout() {
  const { t } = useTranslation('settings')
  const { pathname } = useLocation()
  const isIndex = pathname === '/settings' || pathname === '/settings/'

  // Remember the section the operator has open so re-entering Settings (after
  // visiting another sidebar page) reopens it instead of the first section.
  useEffect(() => {
    if (!isIndex) setLastSettingsSection(pathname)
  }, [pathname, isIndex])

  return (
    <PagePermissionGuard permission="settings.view">
      <div className="flex min-h-full flex-col overflow-hidden md:h-[calc(100dvh_-_3rem)] md:flex-row md:rounded-xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:md:border-gray-800 dark:md:bg-gray-900">
        {/* Category rail */}
        <aside
          className={`${
            isIndex ? 'flex' : 'hidden'
          } min-h-0 w-full shrink-0 flex-col md:flex md:border-gray-200 md:bg-white md:w-56 md:border-r lg:w-60 dark:md:border-gray-800 dark:md:bg-gray-900`}
        >
          <div className="shrink-0 pb-3 md:px-4 md:pt-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('title')}
            </h1>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-4 md:px-3">
            <SettingsSidebar />
          </div>
        </aside>

        {/* Content pane */}
        <section
          className={`${
            isIndex ? 'hidden' : 'flex'
          } min-h-0 min-w-0 flex-1 flex-col md:flex md:bg-gray-50 dark:md:bg-gray-950`}
        >
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div
              className="flex min-h-full w-full flex-col md:p-6"
              data-testid="settings-panel"
            >
              {!isIndex && (
                <Link
                  to="/settings"
                  className="mb-4 inline-flex w-fit items-center gap-2 text-sm text-gray-600 hover:text-gray-900 md:hidden dark:text-gray-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('nav.back')}
                </Link>
              )}
              <Outlet />
            </div>
          </div>
        </section>
      </div>
    </PagePermissionGuard>
  )
}
