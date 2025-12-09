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

import { ConfirmModal } from '~/ui/modal'
import { SongSlideCard } from './SongSlideCard'

export interface LocalSlide {
  id: string | number
  content: string
  sortOrder: number
  label?: string | null
}

interface SongSlideListProps {
  slides: LocalSlide[]
  onSlidesChange: (slides: LocalSlide[]) => void
}

export function SongSlideList({ slides, onSlidesChange }: SongSlideListProps) {
  const { t } = useTranslation('songs')
  const [slideToDelete, setSlideToDelete] = useState<LocalSlide | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id)
      const newIndex = slides.findIndex((s) => s.id === over.id)

      const newOrder = arrayMove(slides, oldIndex, newIndex).map(
        (slide, idx) => ({
          ...slide,
          sortOrder: idx,
        }),
      )
      onSlidesChange(newOrder)
    }
  }

  const handleAddSlide = () => {
    const newSlide: LocalSlide = {
      id: `temp-${Date.now()}`,
      content: '',
      sortOrder: slides.length,
    }
    onSlidesChange([...slides, newSlide])
  }

  const handleSlideContentChange = (
    slideId: string | number,
    content: string,
  ) => {
    const updatedSlides = slides.map((slide) =>
      slide.id === slideId ? { ...slide, content } : slide,
    )
    onSlidesChange(updatedSlides)
  }

  const handleCloneSlide = (slide: LocalSlide) => {
    const slideIndex = slides.findIndex((s) => s.id === slide.id)
    const clonedSlide: LocalSlide = {
      id: `temp-${Date.now()}`,
      content: slide.content,
      sortOrder: slideIndex + 1,
    }

    const newSlides = [
      ...slides.slice(0, slideIndex + 1),
      clonedSlide,
      ...slides.slice(slideIndex + 1),
    ].map((s, idx) => ({ ...s, sortOrder: idx }))

    onSlidesChange(newSlides)
  }

  const handleDeleteConfirm = () => {
    if (!slideToDelete) return

    const newSlides = slides
      .filter((s) => s.id !== slideToDelete.id)
      .map((s, idx) => ({ ...s, sortOrder: idx }))

    onSlidesChange(newSlides)
    setSlideToDelete(null)
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
            <div className="space-y-3">
              {slides.map((slide, index) => (
                <SongSlideCard
                  key={slide.id}
                  slide={slide}
                  index={index}
                  onContentChange={(content) =>
                    handleSlideContentChange(slide.id, content)
                  }
                  onClone={() => handleCloneSlide(slide)}
                  onDelete={() => setSlideToDelete(slide)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <FileQuestion className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('editor.noSlides')}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleAddSlide}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
      >
        <Plus size={20} />
        {t('actions.addSlide')}
      </button>

      <ConfirmModal
        isOpen={!!slideToDelete}
        onCancel={() => setSlideToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={t('modal.deleteSlideTitle')}
        message={t('modal.deleteSlideMessage')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('common:buttons.cancel', 'Cancel')}
        variant="danger"
      />
    </div>
  )
}
