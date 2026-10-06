import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { LiveTranslationStreamsCard } from '~/features/live-translation'
import { Page, PageHeader } from '~/ui/page'

export const Route = createFileRoute('/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation('sidebar')

  return (
    <Page>
      <PageHeader title={t('navigation.dashboard')} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <LiveTranslationStreamsCard />
      </div>
    </Page>
  )
}
