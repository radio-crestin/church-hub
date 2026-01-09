import { Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BroadcastInfo } from './BroadcastInfo'
import { LivestreamSettingsModal } from './LivestreamSettingsModal'
import { MixerConnectionButton } from './MixerConnectionButton'
import { OBSConnectionButton } from './OBSConnectionButton'
import { SceneGrid } from './SceneGrid'
import { StreamControls } from './StreamControls'
import { YouTubeConnectionButton } from './YouTubeConnectionButton'
import { useLivestreamWebSocket } from '../hooks'

export function LiveStreamPage() {
  const { t } = useTranslation('livestream')
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  useLivestreamWebSocket()

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
              title={t('settings.title', {
                defaultValue: 'Livestream Settings',
              })}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t('settings.button', { defaultValue: 'Settings' })}
              </span>
            </button>
            <StreamControls />
          </div>
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

      <LivestreamSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  )
}
