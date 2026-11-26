import { Music, Play, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '~/ui/page'
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
    return <EmptyState icon={Music} title={t('player.emptyQueue')} />
  }

  return (
    <div className="space-y-1 overflow-hidden">
      {queue.map((item, index) => (
        <div
          key={item.id}
          className={`flex items-center gap-1 sm:gap-2 p-2 rounded-lg cursor-pointer group overflow-hidden ${
            index === currentIndex
              ? 'bg-live-tint ring-1 ring-inset ring-live'
              : 'hover:bg-hover'
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
          data-testid="music-queue-item"
          data-current={index === currentIndex || undefined}
        >
          <div className="w-5 h-5 shrink-0 flex items-center justify-center text-xs font-medium tabular-nums text-fg-hint">
            {index === currentIndex ? (
              <Play className="h-3 w-3 fill-current text-live" />
            ) : (
              index + 1
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-fg-body truncate">
              {item.title || item.filename}
            </p>
            {item.artist && (
              <p className="text-xs text-fg-hint truncate">{item.artist}</p>
            )}
          </div>
          <span className="text-xs tabular-nums text-fg-hint shrink-0">
            {formatDuration(item.duration)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveFromQueue(item.id)
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-opacity hover:bg-hover lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            title={t('player.removeFromQueue')}
            aria-label={t('player.removeFromQueue')}
          >
            <X className="h-3.5 w-3.5 text-fg-label" strokeWidth={1.75} />
          </button>
        </div>
      ))}
    </div>
  )
}
