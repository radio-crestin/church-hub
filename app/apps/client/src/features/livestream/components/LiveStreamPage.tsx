import { Radio } from 'lucide-react'
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
    <div className="flex flex-col h-full lg:overflow-hidden overflow-auto scrollbar-thin">
      <div className="flex items-center gap-3 mb-3 lg:mb-4 flex-shrink-0">
        <Radio className="w-6 h-6 text-red-600 dark:text-red-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <YouTubeConnectionButton />
          <OBSConnectionButton />
          <MixerConnectionButton />
        </div>
        <StreamControls />
      </div>

      <div className="space-y-4 lg:space-y-6 flex-1 lg:overflow-auto">
        <BroadcastInfo />

        <div className="mt-2 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <SceneGrid />
        </div>
      </div>
    </div>
  )
}
