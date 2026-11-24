import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { QueueList } from './QueueList'
import { QueueOrderPicker } from './QueueOrderPicker'
import type { ServerAudioPlayer } from '../hooks'

/** The queue: its order, and the tracks to come. */
export function PlayerQueue({ player }: { player: ServerAudioPlayer }) {
  const { t } = useTranslation('music')
  const { state } = player

  return (
    <div className="flex flex-col lg:flex-1 lg:min-h-0">
      <div className="flex items-center justify-between p-3 sm:p-4 pb-2 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('player.queue')}
        </span>
        {state.queueLength > 0 && (
          <button
            type="button"
            onClick={player.clearQueue}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            title={t('player.clearQueue')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="px-3 sm:px-4 pb-2 flex-shrink-0">
        <QueueOrderPicker
          order={state.queueOrder}
          onChange={player.setQueueOrder}
        />
      </div>
      <div className="lg:flex-1 lg:overflow-y-auto px-3 sm:px-4 pb-4 scrollbar-thin">
        <QueueList
          queue={state.queue}
          currentIndex={state.currentIndex}
          onPlayAtIndex={player.playAtIndex}
          onRemoveFromQueue={player.removeFromQueue}
        />
      </div>
    </div>
  )
}
