import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '~/ui/page'
import { SettingsPageRail } from './SettingsPageRail'
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
  children: ReactNode
  testId?: string
}

/**
 * A livestream settings page, laid out like the app settings: a rail on the
 * left with the settings pages, and the page's sections full width beside it,
 * the one in view highlighted; each column scrolls on its own. On a phone the
 * rail is hidden and the back link leads out.
 */
export function SettingsPageLayout({
  back,
  title,
  description,
  actions,
  footer,
  children,
  testId,
}: SettingsPageLayoutProps) {
  const { t } = useTranslation('livestream')
  const pane = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  useActiveSection(pane, content)

  return (
    <div
      data-testid={testId}
      className="flex min-h-full flex-col overflow-hidden rounded-xl border border-line bg-panel md:h-[calc(100dvh_-_3rem)] md:flex-row"
    >
      <aside className="hidden min-h-0 w-56 shrink-0 flex-col border-r border-line bg-panel md:flex lg:w-60">
        <div className="shrink-0 px-4 pb-3 pt-4">
          <Link
            to={back?.to ?? '/livestream'}
            className="mb-2 inline-flex w-fit items-center gap-1 text-sm font-medium text-fg-label hover:text-fg"
          >
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
            {back?.label ?? t('settingsPages.back')}
          </Link>
          <h2 className="text-base font-semibold text-fg">
            {t('settingsPages.railTitle')}
          </h2>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <SettingsPageRail />
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-app">
        <div
          ref={pane}
          className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
        >
          <div className="flex w-full flex-col gap-4 p-4 md:p-6">
            <Link
              to={back?.to ?? '/livestream'}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-fg-label hover:text-fg md:hidden"
            >
              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
              {back?.label ?? t('settingsPages.back')}
            </Link>
            <PageHeader
              title={title}
              description={description}
              actions={actions}
            />
            <div ref={content} className="flex flex-col gap-4">
              {children}
            </div>
          </div>
        </div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-line bg-panel px-4 py-3 md:px-6">
            {footer}
          </div>
        )}
      </section>
    </div>
  )
}
