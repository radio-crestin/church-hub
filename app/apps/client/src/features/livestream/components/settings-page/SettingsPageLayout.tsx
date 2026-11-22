import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '~/ui/page'
import { SettingsPageRail } from './SettingsPageRail'
import type { SettingsPageSection } from './settingsPageSection'
import { useActiveSection } from './useActiveSection'

interface SettingsPageLayoutProps {
  /** Where the back link goes: Live Stream unless given. */
  back?: { to: '/settings/livestream'; label: string }
  title: string
  description: string
  /** Buttons on the right of the title. */
  actions?: ReactNode
  /** A bar kept at the bottom of the pane (e.g. Save). */
  footer?: ReactNode
  /** The page's sections, in order, listed in the rail. */
  sections?: SettingsPageSection[]
  children: ReactNode
  testId?: string
}

/**
 * A livestream settings page, laid out like the app settings: a rail on the
 * left (the settings pages, the page's sections) and the sections full width
 * in the pane beside it, each scrolling on its own. On a phone the rail is
 * hidden and the back link leads out.
 */
export function SettingsPageLayout({
  back,
  title,
  description,
  actions,
  footer,
  sections = [],
  children,
  testId,
}: SettingsPageLayoutProps) {
  const { t } = useTranslation('livestream')
  const pane = useRef<HTMLDivElement>(null)
  const activeSection = useActiveSection(pane, sections)

  const pickSection = (id: string) =>
    pane.current
      ?.querySelector(`[data-testid="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div
      data-testid={testId}
      className="flex min-h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:h-[calc(100dvh_-_3rem)] md:flex-row dark:border-gray-800 dark:bg-gray-900"
    >
      <aside className="hidden min-h-0 w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex lg:w-60 dark:border-gray-800 dark:bg-gray-900">
        <div className="shrink-0 px-4 pb-3 pt-4">
          <Link
            to={back?.to ?? '/livestream'}
            className="mb-2 inline-flex w-fit items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {back?.label ?? t('settingsPages.back')}
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('settingsPages.railTitle')}
          </h2>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <SettingsPageRail
            sections={sections}
            activeSection={activeSection}
            onPickSection={pickSection}
          />
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50 dark:bg-gray-950">
        <div
          ref={pane}
          className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
        >
          <div className="flex w-full flex-col gap-4 p-4 md:p-6">
            <Link
              to={back?.to ?? '/livestream'}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-indigo-600 hover:underline md:hidden dark:text-indigo-400"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {back?.label ?? t('settingsPages.back')}
            </Link>
            <PageHeader
              title={title}
              description={description}
              actions={actions}
            />
            {children}
          </div>
        </div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-3 md:px-6 dark:border-gray-800 dark:bg-gray-900">
            {footer}
          </div>
        )}
      </section>
    </div>
  )
}
