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
      <div className="flex min-h-full flex-col overflow-hidden md:h-[calc(100dvh_-_3rem)] md:flex-row md:rounded-xl md:border md:border-line md:bg-panel">
        {/* Category rail */}
        <aside
          className={`${
            isIndex ? 'flex' : 'hidden'
          } min-h-0 w-full shrink-0 flex-col md:flex md:border-line md:bg-panel md:w-56 md:border-r lg:w-60`}
        >
          <div className="shrink-0 pb-3 md:px-4 md:pt-4">
            <h1 className="text-base font-semibold text-fg">{t('title')}</h1>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-4 md:px-3">
            <SettingsSidebar />
          </div>
        </aside>

        {/* Content pane */}
        <section
          className={`${
            isIndex ? 'hidden' : 'flex'
          } min-h-0 min-w-0 flex-1 flex-col md:flex md:bg-app`}
        >
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div
              className="flex min-h-full w-full flex-col md:p-6"
              data-testid="settings-panel"
            >
              {!isIndex && (
                <Link
                  to="/settings"
                  className="mb-4 inline-flex w-fit items-center gap-2 text-[13px] text-fg-label hover:text-fg md:hidden"
                >
                  <ArrowLeft strokeWidth={1.5} className="h-4 w-4" />
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
