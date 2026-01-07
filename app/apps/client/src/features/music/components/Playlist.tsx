import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ListMusic, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { PlaylistItem } from './PlaylistItem'
import type { QueueItem } from '../types'

interface PlaylistProps {
  items: QueueItem[]
  currentIndex: number
  onReorder: (items: QueueItem[]) => void
  onPlayItem: (index: number) => void
  onRemoveItem: (index: number) => void
  onClear: () => void
}

export function Playlist({
  items,
  currentIndex,
  onReorder,
  onPlayItem,
  onRemoveItem,
  onClear,
}: PlaylistProps) {
  const { t } = useTranslation('music')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.queueId === active.id)
      const newIndex = items.findIndex((item) => item.queueId === over.id)
      const newItems = arrayMove(items, oldIndex, newIndex)
      onReorder(newItems)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ListMusic className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          {t('player.queueEmpty')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('player.addSongsToQueue')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {t('player.queue')} ({items.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 text-xs"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          {t('player.clearQueue')}
        </Button>
      </div>

      <div className="h-[200px] overflow-y-auto scrollbar-thin">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext
            items={items.map((item) => item.queueId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1 pr-1">
              {items.map((item, index) => (
                <PlaylistItem
                  key={item.queueId}
                  item={item}
                  isPlaying={index === currentIndex}
                  onPlay={() => onPlayItem(index)}
                  onRemove={() => onRemoveItem(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
