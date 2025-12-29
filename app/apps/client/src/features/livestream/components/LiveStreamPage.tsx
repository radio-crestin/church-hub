import { useTranslation } from 'react-i18next'

import { BroadcastInfo } from './BroadcastInfo'
import { MixerConnectionButton } from './MixerConnectionButton'
import { OBSConnectionButton } from './OBSConnectionButton'
import { SceneGrid } from './SceneGrid'
import { StreamControls } from './StreamControls'
import { YouTubeConnectionButton } from './YouTubeConnectionButton'
import { useLivestreamWebSocket } from '../hooks'

export function LiveStreamPage() {
  const { t } = useTranslation('livestream')

  useLivestreamWebSocket()

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('title')}
          </h1>
          <StreamControls />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YouTubeConnectionButton />
          <OBSConnectionButton />
          <MixerConnectionButton />
        </div>
      </div>

      <BroadcastInfo />

      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <SceneGrid />
      </div>
    </div>
  )
}
