import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MusicSection } from './MusicSection'
import { QueueList } from './QueueList'
import { QueueOrderPicker } from './QueueOrderPicker'
import type { ServerAudioPlayer } from '../hooks'

/** The queue: its order, and the tracks to come. */
export function PlayerQueue({ player }: { player: ServerAudioPlayer }) {
  const { t } = useTranslation('music')
  const { state } = player

  return (
    <MusicSection
      title={t('player.queue')}
      count={state.queueLength}
      countLabel={t('player.queueCount', { count: state.queueLength })}
      actions={
        state.queueLength > 0 && (
          <button
            type="button"
            onClick={player.clearQueue}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg"
            title={t('player.clearQueue')}
            aria-label={t('player.clearQueue')}
            data-testid="music-clear-queue"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )
      }
      className="lg:flex-1 lg:min-h-0"
      testId="music-queue"
    >
      <QueueOrderPicker
        order={state.queueOrder}
        onChange={player.setQueueOrder}
      />
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-thin">
        <QueueList
          queue={state.queue}
          currentIndex={state.currentIndex}
          onPlayAtIndex={player.playAtIndex}
          onRemoveFromQueue={player.removeFromQueue}
        />
      </div>
    </MusicSection>
  )
}
