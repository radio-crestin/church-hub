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
import { ListMusic, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongEditorModal, SongPickerModal } from '~/features/songs/components'
import { useToast } from '~/ui/toast'
import { InsertSlideModal } from './InsertSlideModal'
import { ScheduleItemBiblePassage } from './ScheduleItemBiblePassage'
import { ScheduleItemSlide } from './ScheduleItemSlide'
import { ScheduleItemSong } from './ScheduleItemSong'
import { ScheduleItemVerseteTineri } from './ScheduleItemVerseteTineri'
import {
  useAddItemToSchedule,
  useRemoveItemFromSchedule,
  useReorderScheduleItems,
} from '../hooks'
import type { ScheduleItem, SlideTemplate } from '../types'

interface SortableScheduleItemProps {
  scheduleId: number
  item: ScheduleItem
  onEditSong: (songId: number) => void
  onEditSlide: (item: ScheduleItem) => void
  onInsertSongAfter: (itemId: number) => void
  onInsertSlideAfter: (itemId: number, template: SlideTemplate) => void
  onRemoveItem?: (itemId: number) => void
}

function SortableScheduleItem({
  scheduleId,
  item,
  onEditSong,
  onEditSlide,
  onInsertSongAfter,
  onInsertSlideAfter,
  onRemoveItem,
}: SortableScheduleItemProps) {
  const { showToast } = useToast()
  const { t } = useTranslation('schedules')
  const removeItemMutation = useRemoveItemFromSchedule()

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleRemove = async () => {
    // Use callback if provided (local state management)
    if (onRemoveItem) {
      onRemoveItem(item.id)
    } else {
      // Fallback to direct mutation (backward compatibility)
      const success = await removeItemMutation.mutateAsync({
        scheduleId,
        itemId: item.id,
      })
      if (success) {
        showToast(t('messages.itemRemoved'), 'success')
      }
    }
  }

  if (item.itemType === 'bible_passage') {
    return (
      <div ref={setNodeRef} style={style}>
        <ScheduleItemBiblePassage
          item={item}
          onRemove={handleRemove}
          onInsertSongAfter={() => onInsertSongAfter(item.id)}
          onInsertSlideAfter={(template) =>
            onInsertSlideAfter(item.id, template)
          }
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </div>
    )
  }

  if (item.itemType === 'slide' && item.slideType === 'versete_tineri') {
    return (
      <div ref={setNodeRef} style={style}>
        <ScheduleItemVerseteTineri
          item={item}
          onRemove={handleRemove}
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

  if (item.itemType === 'slide') {
    return (
      <div ref={setNodeRef} style={style}>
        <ScheduleItemSlide
          item={item}
          onRemove={handleRemove}
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
    <div ref={setNodeRef} style={style}>
      <ScheduleItemSong
        item={item}
        onRemove={handleRemove}
        onEditSong={() => item.songId && onEditSong(item.songId)}
        onInsertSongAfter={() => onInsertSongAfter(item.id)}
        onInsertSlideAfter={(template) => onInsertSlideAfter(item.id, template)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

interface ScheduleItemListProps {
  scheduleId: number
  items: ScheduleItem[]
  isLoading?: boolean
  onReorder?: (oldIndex: number, newIndex: number) => void
  onRemoveItem?: (itemId: number) => void
}

export function ScheduleItemList({
  scheduleId,
  items,
  isLoading,
  onReorder,
  onRemoveItem,
}: ScheduleItemListProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()

  const reorderItems = useReorderScheduleItems()
  const addItem = useAddItemToSchedule()

  const [editingSongId, setEditingSongId] = useState<number | null>(null)
  const [editingSlideItem, setEditingSlideItem] = useState<ScheduleItem | null>(
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && items) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // Use callback if provided (local state management)
        if (onReorder) {
          onReorder(oldIndex, newIndex)
        } else {
          // Fallback to direct mutation (backward compatibility)
          const newOrder = [...items]
          const [removed] = newOrder.splice(oldIndex, 1)
          newOrder.splice(newIndex, 0, removed)

          reorderItems.mutate({
            scheduleId,
            input: { itemIds: newOrder.map((item) => item.id) },
          })
        }
      }
    }
  }

  const handleSongSelected = async (songId: number) => {
    const result = await addItem.mutateAsync({
      scheduleId,
      input: { songId, afterItemId: insertSongAfterItemId ?? undefined },
    })
    if (result.success) {
      showToast(t('messages.itemAdded'), 'success')
    }
    setInsertSongAfterItemId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <ListMusic
          size={48}
          className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
        />
        <p className="text-gray-600 dark:text-gray-400 font-medium">
          {t('editor.noItems')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          {t('editor.addFirstItem')}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Sortable List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((item) => (
              <SortableScheduleItem
                key={item.id}
                scheduleId={scheduleId}
                item={item}
                onEditSong={setEditingSongId}
                onEditSlide={setEditingSlideItem}
                onInsertSongAfter={setInsertSongAfterItemId}
                onInsertSlideAfter={(itemId, template) => {
                  setInsertAfterItemId(itemId)
                  setInsertSlideTemplate(template)
                }}
                onRemoveItem={onRemoveItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Song Editor Modal */}
      {editingSongId !== null && (
        <SongEditorModal
          isOpen={editingSongId !== null}
          songId={editingSongId}
          onClose={() => setEditingSongId(null)}
          onSaved={() => {
            // Schedule will be invalidated automatically
          }}
        />
      )}

      {/* Insert Slide Modal - for inserting after item */}
      {insertAfterItemId !== null && (
        <InsertSlideModal
          isOpen={insertAfterItemId !== null}
          afterItemId={insertAfterItemId}
          initialTemplate={insertSlideTemplate}
          scheduleId={scheduleId}
          onClose={() => setInsertAfterItemId(null)}
          onSaved={() => {
            // Schedule will be invalidated automatically
          }}
        />
      )}

      {/* Song Picker Modal for Insert After */}
      <SongPickerModal
        isOpen={insertSongAfterItemId !== null}
        onClose={() => setInsertSongAfterItemId(null)}
        onSongSelect={handleSongSelected}
        hideAddToQueue
      />

      {/* Edit Slide Modal */}
      {editingSlideItem !== null && (
        <InsertSlideModal
          isOpen={editingSlideItem !== null}
          editingItem={{
            id: editingSlideItem.id,
            slideType: editingSlideItem.slideType,
            slideContent: editingSlideItem.slideContent,
            verseteTineriEntries: editingSlideItem.verseteTineriEntries,
          }}
          scheduleId={scheduleId}
          onClose={() => setEditingSlideItem(null)}
          onSaved={() => {
            // Schedule will be invalidated automatically
          }}
        />
      )}
    </>
  )
}
