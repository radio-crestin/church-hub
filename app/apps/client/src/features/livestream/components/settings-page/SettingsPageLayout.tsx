import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Page, PageHeader } from '~/ui/page'

interface SettingsPageLayoutProps {
  /** Where the back link goes: Live Stream unless given. */
  back?: { to: '/settings/livestream'; label: string }
  title: string
  description: string
  /** Buttons on the right of the title. */
  actions?: ReactNode
  /** A bar kept at the bottom of the window (e.g. Save). */
  footer?: ReactNode
  children: ReactNode
  testId?: string
}

/** A livestream settings page: a back link, its title, its sections. */
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

  return (
    <Page testId={testId}>
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-2">
        <Link
          to={back?.to ?? '/livestream'}
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {back?.label ?? t('settingsPages.back')}
        </Link>
        <PageHeader title={title} description={description} actions={actions} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-4">
          {children}
        </div>
      </div>
      {footer && (
        <div className="shrink-0 border-t border-gray-200 pt-3 dark:border-gray-700">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-3">
            {footer}
          </div>
        </div>
      )}
    </Page>
  )
}
