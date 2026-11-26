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
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { AddSlideMenu } from './AddSlideMenu'
import { SortableSlideThumb } from './SortableSlideThumb'
import type { DeckSlideKind, SlideDeck } from '../../types'

interface SlideThumbnailListProps {
  deck: SlideDeck
  selectedSlideId: string
  /** A strip across the top (a phone), else a column on the left. */
  horizontal: boolean
  onSelect: (slideId: string) => void
  onAdd: (kind: DeckSlideKind) => void
  onDuplicate: (slideId: string) => void
  onDelete: (slideId: string) => void
  onMove: (from: number, to: number) => void
}

/** The deck's slides drawn small, in order: pick, drag to reorder, add, copy, delete. */
export function SlideThumbnailList({
  deck,
  selectedSlideId,
  horizontal,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: SlideThumbnailListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = deck.slides.findIndex((s) => s.id === active.id)
    const to = deck.slides.findIndex((s) => s.id === over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }
  const list = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={deck.slides.map((s) => s.id)}
        strategy={
          horizontal
            ? horizontalListSortingStrategy
            : verticalListSortingStrategy
        }
      >
        {deck.slides.map((slide, index) => (
          <SortableSlideThumb
            key={slide.id}
            slide={slide}
            index={index}
            width={deck.width}
            height={deck.height}
            boxWidth={horizontal ? 96 : 144}
            selected={slide.id === selectedSlideId}
            canDelete={deck.slides.length > 1}
            onSelect={() => onSelect(slide.id)}
            onDuplicate={() => onDuplicate(slide.id)}
            onDelete={() => onDelete(slide.id)}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
  // On a phone the strip scrolls sideways; "New slide" stays outside it, so
  // its menu isn't cut off by the scrolling.
  return horizontal ? (
    <div
      data-testid="deck-editor-slides"
      className="flex items-center gap-1 p-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {list}
      </div>
      <AddSlideMenu onAdd={onAdd} />
    </div>
  ) : (
    <div data-testid="deck-editor-slides" className="flex flex-col gap-1 p-2">
      {list}
      <AddSlideMenu onAdd={onAdd} />
    </div>
  )
}
