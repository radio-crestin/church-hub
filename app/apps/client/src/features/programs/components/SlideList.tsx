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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { FileQuestion, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal/ConfirmModal'
import { useToast } from '~/ui/toast/useToast'
import { SlideCard } from './SlideCard'
import { SlideEditorModal } from './SlideEditorModal'
import { useDeleteSlide, useReorderSlides } from '../hooks'
import type { Slide } from '../types'

interface SlideListProps {
  programId: number
  slides: Slide[]
}

export function SlideList({ programId, slides }: SlideListProps) {
  const { t } = useTranslation('programs')
  const { showToast } = useToast()
  const deleteSlide = useDeleteSlide()
  const reorderSlides = useReorderSlides()

  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [slideToDelete, setSlideToDelete] = useState<Slide | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id)
      const newIndex = slides.findIndex((s) => s.id === over.id)

      const newOrder = arrayMove(slides, oldIndex, newIndex)
      const slideIds = newOrder.map((s) => s.id)

      try {
        await reorderSlides.mutateAsync({ programId, slideIds })
      } catch {
        showToast(t('slides.messages.reorderFailed'), 'error')
      }
    }
  }

  const handleDeleteConfirm = async () => {
    if (!slideToDelete) return

    try {
      await deleteSlide.mutateAsync({
        slideId: slideToDelete.id,
        programId,
      })
      showToast(t('slides.messages.deleted'), 'success')
    } catch {
      showToast(t('slides.messages.deleteFailed'), 'error')
    } finally {
      setSlideToDelete(null)
    }
  }

  return (
    <div className="space-y-4">
      {slides.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  index={index}
                  onEdit={setEditingSlide}
                  onDelete={setSlideToDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <FileQuestion className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {t('slides.messages.empty')}
          </p>
        </div>
      )}

      <button
        onClick={() => setIsCreating(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
      >
        <Plus size={20} />
        {t('slides.actions.add')}
      </button>

      {/* Edit/Create Slide Modal */}
      <SlideEditorModal
        isOpen={!!editingSlide || isCreating}
        onClose={() => {
          setEditingSlide(null)
          setIsCreating(false)
        }}
        programId={programId}
        slide={editingSlide}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!slideToDelete}
        onClose={() => setSlideToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={t('slides.deleteModal.title')}
        message={t('slides.deleteModal.message')}
        confirmText={t('slides.deleteModal.confirm')}
        cancelText={t('slides.deleteModal.cancel')}
        isLoading={deleteSlide.isPending}
        variant="danger"
      />
    </div>
  )
}
