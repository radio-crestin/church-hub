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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ScreenWithConfigs } from '~/features/presentation'
import { SlideThumbnail } from './SlideThumbnail'
import type { LocalSlide } from '../SongSlideList'

interface SlideFilmstripProps {
  screen: ScreenWithConfigs
  songId: number
  title: string
  keyLine: string | null
  slides: LocalSlide[]
  activeIndex: number
  presentedSlideId?: number | null
  onSelect: (index: number) => void
  onReorder: (event: DragEndEvent) => void
  onClone: (slide: LocalSlide) => void
  onDelete: (slide: LocalSlide) => void
  onAdd: () => void
  /** Project a slide to the screen by index, without moving the editor. */
  onProject?: (index: number) => void
}

/**
 * Vertical filmstrip of slide thumbnails (PowerPoint-style). Supports
 * drag-to-reorder, select, clone, delete and add.
 */
export function SlideFilmstrip({
  screen,
  songId,
  title,
  keyLine,
  slides,
  activeIndex,
  presentedSlideId,
  onSelect,
  onReorder,
  onClone,
  onDelete,
  onAdd,
  onProject,
}: SlideFilmstripProps) {
  const { t } = useTranslation('songs')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onReorder}
      >
        <SortableContext
          items={slides.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {slides.map((slide, index) => (
              <SlideThumbnail
                key={slide.id}
                screen={screen}
                songId={songId}
                title={title}
                keyLine={keyLine}
                slides={slides}
                index={index}
                isActive={index === activeIndex}
                isPresented={
                  typeof slide.id === 'number' && slide.id === presentedSlideId
                }
                onSelect={() => onSelect(index)}
                onClone={() => onClone(slide)}
                onDelete={() => onDelete(slide)}
                onProject={onProject ? () => onProject(index) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        data-testid="stage-add-slide"
        onClick={onAdd}
        className="flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
      >
        <Plus size={16} />
        {t('actions.addSlide')}
      </button>
    </div>
  )
}
