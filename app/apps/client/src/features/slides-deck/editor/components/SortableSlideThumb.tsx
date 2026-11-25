import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DeckSlideThumbnail } from '../../components/DeckSlideThumbnail'
import type { DeckSlide } from '../../types'

interface SortableSlideThumbProps {
  slide: DeckSlide
  index: number
  width: number
  height: number
  boxWidth: number
  selected: boolean
  canDelete: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** A slide in the editor's slide list: picked, dragged to its place, copied, deleted. */
export function SortableSlideThumb({
  slide,
  index,
  width,
  height,
  boxWidth,
  selected,
  canDelete,
  onSelect,
  onDuplicate,
  onDelete,
}: SortableSlideThumbProps) {
  const { t } = useTranslation('schedules')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })
  return (
    <div
      ref={setNodeRef}
      data-testid="deck-editor-slide"
      data-slide-id={slide.id}
      data-selected={selected || undefined}
      className={`group relative flex shrink-0 touch-none items-start gap-1.5 rounded-lg p-1.5 ${
        selected
          ? 'bg-indigo-100 dark:bg-indigo-900/40'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      } ${isDragging ? 'z-10 opacity-60' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onSelect}
    >
      <span className="w-4 pt-0.5 text-right text-xs text-gray-500">
        {index + 1}
      </span>
      <span
        className={`rounded ring-2 ${selected ? 'ring-indigo-500' : 'ring-transparent'}`}
      >
        <DeckSlideThumbnail
          slide={slide}
          width={width}
          height={height}
          boxWidth={boxWidth}
        />
      </span>
      <span className="absolute right-2 bottom-2 hidden gap-1 group-hover:flex group-data-[selected]:flex">
        <button
          type="button"
          data-testid="deck-editor-slide-duplicate"
          title={t('deckEditor.duplicateSlide')}
          aria-label={t('deckEditor.duplicateSlide')}
          className="rounded bg-white/90 p-1 text-gray-700 shadow hover:bg-white"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
        >
          <Copy size={12} />
        </button>
        {canDelete && (
          <button
            type="button"
            data-testid="deck-editor-slide-delete"
            title={t('deckEditor.deleteSlide')}
            aria-label={t('deckEditor.deleteSlide')}
            className="rounded bg-white/90 p-1 text-red-600 shadow hover:bg-white"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </span>
    </div>
  )
}
