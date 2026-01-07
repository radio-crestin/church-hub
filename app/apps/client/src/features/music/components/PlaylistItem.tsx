import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Play, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { cn } from '~/ui/utils'
import type { QueueItem } from '../types'
import { formatDuration } from '../utils'

interface PlaylistItemProps {
  item: QueueItem
  isPlaying: boolean
  onPlay: () => void
  onRemove: () => void
}

export function PlaylistItem({
  item,
  isPlaying,
  onPlay,
  onRemove,
}: PlaylistItemProps) {
  const { t } = useTranslation('music')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.queueId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const displayTitle = item.title || item.filename

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg group',
        isDragging && 'opacity-50',
        isPlaying && 'bg-primary/10',
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onPlay}
        title={t('player.play')}
      >
        <Play className="h-3 w-3" />
      </Button>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate',
            isPlaying && 'font-medium text-primary',
          )}
        >
          {displayTitle}
        </p>
      </div>

      <span className="text-xs text-muted-foreground tabular-nums">
        {item.duration ? formatDuration(item.duration) : '--:--'}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
