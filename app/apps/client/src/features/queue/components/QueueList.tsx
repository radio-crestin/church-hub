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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongEditorModal, SongPickerModal } from '~/features/songs/components'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { InsertSlideModal } from './InsertSlideModal'
import { QueueSlideItem } from './QueueSlideItem'
import { QueueSongItem } from './QueueSongItem'
import {
  useClearQueue,
  useQueue,
  useRemoveFromQueue,
  useReorderQueue,
  useSetQueueItemExpanded,
} from '../hooks'
import type { QueueItem, SlideTemplate } from '../types'

interface SortableQueueItemProps {
  item: QueueItem
  activeSlideId: number | null
  activeQueueItemId: number | null
  onSlideClick: (slideId: number) => void
  onSongClick: () => void
  onEditSong: (songId: number) => void
  onEditSlide: (item: QueueItem) => void
  onInsertSongAfter: (itemId: number) => void
  onInsertSlideAfter: (itemId: number, template: SlideTemplate) => void
  onStandaloneSlideClick: () => void
  itemRef: (element: HTMLDivElement | null) => void
}

function SortableQueueItem({
  item,
  activeSlideId,
  activeQueueItemId,
  onSlideClick,
  onSongClick,
  onEditSong,
  onEditSlide,
  onInsertSongAfter,
  onInsertSlideAfter,
  onStandaloneSlideClick,
  itemRef,
}: SortableQueueItemProps) {
  const { showToast } = useToast()
  const { t } = useTranslation('queue')
  const removeFromQueue = useRemoveFromQueue()
  const setExpanded = useSetQueueItemExpanded()

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id })

  // Combine sortable ref with item ref for scroll tracking
  const combinedRef = useCallback(
    (element: HTMLDivElement | null) => {
      setNodeRef(element)
      itemRef(element)
    },
    [setNodeRef, itemRef],
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleToggleExpand = () => {
    setExpanded.mutate({ id: item.id, expanded: !item.isExpanded })
  }

  const handleRemove = async () => {
    const success = await removeFromQueue.mutateAsync(item.id)
    if (success) {
      showToast(t('messages.removed'), 'success')
    }
  }

  // Render different components based on item type
  if (item.itemType === 'slide') {
    // Standalone slide is active when it's the current queue item with no song slide
    const isActive = item.id === activeQueueItemId && activeSlideId === null

    return (
      <div ref={combinedRef} style={style}>
        <QueueSlideItem
          item={item}
          isActive={isActive}
          onRemove={handleRemove}
          onClick={onStandaloneSlideClick}
          onEditSlide={() => onEditSlide(item)}
          onInsertSongAfter={() => onInsertSongAfter(item.id)}
          onInsertSlideAfter={(template) =>
            onInsertSlideAfter(item.id, template)
          }
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </div>
    )
  }

  return (
    <div ref={combinedRef} style={style}>
      <QueueSongItem
        item={item}
        isExpanded={item.isExpanded}
        activeSlideId={activeSlideId}
        activeQueueItemId={activeQueueItemId}
        onToggleExpand={handleToggleExpand}
        onRemove={handleRemove}
        onSlideClick={onSlideClick}
        onSongClick={onSongClick}
        onEditSong={() => item.songId && onEditSong(item.songId)}
        onInsertSongAfter={() => onInsertSongAfter(item.id)}
        onInsertSlideAfter={(template) => onInsertSlideAfter(item.id, template)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

interface QueueListProps {
  activeSlideId: number | null
  activeQueueItemId: number | null
  onSlideClick: (queueItemId: number, slideId: number) => void
  hideHeader?: boolean
}

export function QueueList({
  activeSlideId,
  activeQueueItemId,
  onSlideClick,
  hideHeader = false,
}: QueueListProps) {
  const { t } = useTranslation('queue')
  const { showToast } = useToast()

  const { data: queue, isLoading } = useQueue()
  const reorderQueue = useReorderQueue()
  const clearQueueMutation = useClearQueue()
  const setExpanded = useSetQueueItemExpanded()

  const [showClearModal, setShowClearModal] = useState(false)
  const [editingSongId, setEditingSongId] = useState<number | null>(null)
  const [editingSlideItem, setEditingSlideItem] = useState<QueueItem | null>(
    null,
  )
  const [insertAfterItemId, setInsertAfterItemId] = useState<number | null>(
    null,
  )
  const [insertSongAfterItemId, setInsertSongAfterItemId] = useState<
    number | null
  >(null)
  const [insertSlideTemplate, setInsertSlideTemplate] =
    useState<SlideTemplate>('announcement')

  // Refs for auto-scroll functionality
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const previousActiveQueueItemId = useRef<number | null>(null)

  // Create callback to register item refs
  const createItemRef = useCallback(
    (itemId: number) => (element: HTMLDivElement | null) => {
      if (element) {
        itemRefs.current.set(itemId, element)
      } else {
        itemRefs.current.delete(itemId)
      }
    },
    [],
  )

  // Auto-scroll to active queue item when it changes
  useEffect(() => {
    // Only scroll if the active queue item actually changed (not on initial render with null)
    if (
      activeQueueItemId !== null &&
      activeQueueItemId !== previousActiveQueueItemId.current
    ) {
      const element = itemRefs.current.get(activeQueueItemId)
      if (element) {
        // Find the scrollable container (parent with overflow-y-auto)
        const scrollContainer = element.closest(
          '[class*="overflow-y-auto"], [class*="overflow-auto"]',
        )
        if (scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect()
          const elementRect = element.getBoundingClientRect()

          // Check if element is not fully visible in the container
          const isAboveViewport = elementRect.top < containerRect.top
          const isBelowViewport = elementRect.bottom > containerRect.bottom

          if (isAboveViewport || isBelowViewport) {
            // Scroll to make the element the first visible item
            element.scrollIntoView({ block: 'start', behavior: 'smooth' })
          }
        }
      }
    }
    previousActiveQueueItemId.current = activeQueueItemId
  }, [activeQueueItemId])

  // Auto-expand the song containing the active slide when it changes
  useEffect(() => {
    if (activeSlideId && queue) {
      const songWithActiveSlide = queue.find(
        (item) =>
          item.itemType === 'song' &&
          item.slides.some((slide) => slide.id === activeSlideId),
      )
      if (songWithActiveSlide && !songWithActiveSlide.isExpanded) {
        setExpanded.mutate({ id: songWithActiveSlide.id, expanded: true })
      }
    }
  }, [activeSlideId, queue, setExpanded])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && queue) {
      const oldIndex = queue.findIndex((item) => item.id === active.id)
      const newIndex = queue.findIndex((item) => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...queue]
        const [removed] = newOrder.splice(oldIndex, 1)
        newOrder.splice(newIndex, 0, removed)

        reorderQueue.mutate({ itemIds: newOrder.map((item) => item.id) })
      }
    }
  }

  const handleSlideClick = (queueItemId: number, slideId: number) => {
    // Auto-expand the song when a slide is clicked
    const item = queue?.find((q) => q.id === queueItemId)
    if (item && !item.isExpanded) {
      setExpanded.mutate({ id: queueItemId, expanded: true })
    }
    onSlideClick(queueItemId, slideId)
  }

  const handleStandaloneSlideClick = (queueItemId: number) => {
    // For standalone slides, we could potentially show them
    // For now, just call onSlideClick with the queue item ID and a special slide ID
    // This would need server-side support to display standalone slides
    onSlideClick(queueItemId, -1)
  }

  const handleSongClick = (item: QueueItem) => {
    // Auto-expand the song
    if (!item.isExpanded) {
      setExpanded.mutate({ id: item.id, expanded: true })
    }
    // Select the first slide if available
    if (item.slides.length > 0) {
      onSlideClick(item.id, item.slides[0].id)
    }
  }

  const handleClearConfirm = async () => {
    setShowClearModal(false)
    const success = await clearQueueMutation.mutateAsync()
    if (success) {
      showToast(t('messages.cleared'), 'success')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!queue || queue.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">{t('empty')}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {t('emptyDescription')}
        </p>
      </div>
    )
  }

  // Count items for display
  const itemCount = queue.length

  return (
    <>
      {/* Header with Item Count and Clear Button */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('itemCount', { count: itemCount })}
          </span>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 size={14} />
            {t('actions.clear')}
          </button>
        </div>
      )}

      {/* Sortable List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={queue.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {queue.map((item) => (
              <SortableQueueItem
                key={item.id}
                item={item}
                activeSlideId={activeSlideId}
                activeQueueItemId={activeQueueItemId}
                onSlideClick={(slideId) => handleSlideClick(item.id, slideId)}
                onSongClick={() => handleSongClick(item)}
                onEditSong={setEditingSongId}
                onEditSlide={setEditingSlideItem}
                onInsertSongAfter={setInsertSongAfterItemId}
                onInsertSlideAfter={(itemId, template) => {
                  setInsertAfterItemId(itemId)
                  setInsertSlideTemplate(template)
                }}
                onStandaloneSlideClick={() =>
                  handleStandaloneSlideClick(item.id)
                }
                itemRef={createItemRef(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearModal}
        title={t('confirmClear.title')}
        message={t('confirmClear.message')}
        confirmLabel={t('actions.clear')}
        onConfirm={handleClearConfirm}
        onCancel={() => setShowClearModal(false)}
        variant="danger"
      />

      {/* Song Editor Modal */}
      {editingSongId !== null && (
        <SongEditorModal
          isOpen={editingSongId !== null}
          songId={editingSongId}
          onClose={() => setEditingSongId(null)}
          onSaved={() => {
            // Queue will be invalidated automatically by the song mutation
          }}
        />
      )}

      {/* Insert Slide Modal */}
      {insertAfterItemId !== null && (
        <InsertSlideModal
          isOpen={insertAfterItemId !== null}
          afterItemId={insertAfterItemId}
          initialTemplate={insertSlideTemplate}
          onClose={() => setInsertAfterItemId(null)}
          onSaved={() => {
            // Queue will be invalidated automatically by the insert mutation
          }}
        />
      )}

      {/* Song Picker Modal for Insert After */}
      <SongPickerModal
        isOpen={insertSongAfterItemId !== null}
        afterItemId={insertSongAfterItemId ?? undefined}
        onClose={() => setInsertSongAfterItemId(null)}
      />

      {/* Edit Slide Modal */}
      {editingSlideItem !== null && (
        <InsertSlideModal
          isOpen={editingSlideItem !== null}
          editingItem={editingSlideItem}
          onClose={() => setEditingSlideItem(null)}
          onSaved={() => {
            // Queue will be invalidated automatically by the update mutation
          }}
        />
      )}
    </>
  )
}
