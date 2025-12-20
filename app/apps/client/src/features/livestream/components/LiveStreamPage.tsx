import { useTranslation } from 'react-i18next'

import { BroadcastInfo } from './BroadcastInfo'
import { OBSConnectionStatus } from './OBSConnectionStatus'
import { SceneGrid } from './SceneGrid'
import { StreamControls } from './StreamControls'
import { YouTubeAuthStatus } from './YouTubeAuthStatus'
import { useLivestreamWebSocket } from '../hooks'

export function LiveStreamPage() {
  const { t } = useTranslation('livestream')

  useLivestreamWebSocket()

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('title')}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            YouTube
          </h2>
          <YouTubeAuthStatus />
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            OBS Studio
          </h2>
          <OBSConnectionStatus />
        </div>
      </div>

      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Stream Control
          </h2>
          <StreamControls />
        </div>

        <BroadcastInfo />
      </div>

      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <SceneGrid />
      </div>
    </div>
  )
}
