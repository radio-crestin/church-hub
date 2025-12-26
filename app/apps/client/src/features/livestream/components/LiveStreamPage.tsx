import { useTranslation } from 'react-i18next'

import { BroadcastInfo } from './BroadcastInfo'
import { MixerConnectionButton } from './MixerConnectionButton'
import { OBSConnectionButton } from './OBSConnectionButton'
import { SceneGrid } from './SceneGrid'
import { StreamControls } from './StreamControls'
import { YouTubeConnectionButton } from './YouTubeConnectionButton'
import { useLivestreamWebSocket, useStreaming } from '../hooks'

export function LiveStreamPage() {
  const { t } = useTranslation('livestream')
  const { isLive } = useStreaming()

  useLivestreamWebSocket()

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('title')}
            </h1>
            {isLive && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-600 rounded-full animate-pulse">
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white rounded-full" />
                <span className="text-[10px] sm:text-xs font-bold text-white">
                  {t('stream.isLive')}
                </span>
              </div>
            )}
          </div>
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
