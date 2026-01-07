import { Music, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { QueueItemSummary } from '../types'

interface QueueListProps {
  queue: QueueItemSummary[]
  currentIndex: number
  onPlayAtIndex: (index: number) => void
  onRemoveFromQueue: (itemId: number) => void
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function QueueList({
  queue,
  currentIndex,
  onPlayAtIndex,
  onRemoveFromQueue,
}: QueueListProps) {
  const { t } = useTranslation('music')

  if (queue.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t('player.emptyQueue')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {queue.map((item, index) => (
        <div
          key={item.id}
          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer group ${
            index === currentIndex
              ? 'bg-purple-100 dark:bg-purple-900/30'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
          onClick={() => onPlayAtIndex(index)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onPlayAtIndex(index)
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="w-6 h-6 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {index === currentIndex ? (
              <span className="text-purple-600 dark:text-purple-400">
                {'\u25B6'}
              </span>
            ) : (
              index + 1
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap overflow-x-auto scrollbar-none">
              {item.title || item.filename}
            </p>
            {item.artist && (
              <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-x-auto scrollbar-none">
                {item.artist}
              </p>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatDuration(item.duration)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveFromQueue(item.id)
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
            title={t('player.removeFromQueue')}
          >
            <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      ))}
    </div>
  )
}
