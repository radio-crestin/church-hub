import { useTranslation } from 'react-i18next'

import { PageHeader } from '~/ui/page'
import { BroadcastInfo } from './BroadcastInfo'
import { LivestreamGuideButton } from './guide/LivestreamGuideButton'
import { SceneGrid } from './SceneGrid'
import { StreamControls } from './StreamControls'
import { LivestreamSettingsLinks } from './toolbar/LivestreamSettingsLinks'
import { useLivestreamWebSocket } from '../hooks'

export function LiveStreamPage() {
  const { t } = useTranslation('livestream')

  useLivestreamWebSocket()

  return (
    <div className="flex flex-col gap-4 h-full lg:overflow-hidden overflow-auto scrollbar-thin">
      <PageHeader
        title={t('title')}
        actions={
          <>
            <StreamControls />
            <LivestreamGuideButton />
          </>
        }
      />

      <LivestreamSettingsLinks />

      <div className="space-y-4 lg:space-y-6 flex-1 lg:overflow-auto">
        <BroadcastInfo />

        <div className="p-4 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <SceneGrid />
        </div>
      </div>
    </div>
  )
}
