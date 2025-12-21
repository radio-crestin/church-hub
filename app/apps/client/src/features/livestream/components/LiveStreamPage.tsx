import { useTranslation } from 'react-i18next'

import { BroadcastInfo } from './BroadcastInfo'
import { GlobalShortcutManager } from './GlobalShortcutManager'
import { OBSConnectionButton } from './OBSConnectionButton'
import { SceneGrid } from './SceneGrid'
import { StreamControls } from './StreamControls'
import { YouTubeConnectionButton } from './YouTubeConnectionButton'
import { useLivestreamWebSocket } from '../hooks'

export function LiveStreamPage() {
  const { t } = useTranslation('livestream')

  useLivestreamWebSocket()

  return (
    <>
      <GlobalShortcutManager />
      <div className="h-full overflow-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('title')}
            </h1>
            <YouTubeConnectionButton />
            <OBSConnectionButton />
          </div>
          <StreamControls />
        </div>

        <BroadcastInfo />

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <SceneGrid />
        </div>
      </div>
    </>
  )
}
