import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Play, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimationRow } from './AnimationRow'
import type { DeckElement, DeckSlide } from '../../types'
import { slideTimeline } from '../../utils/slideTimeline'
import type { DeckAction } from '../types'
import { elementLabel } from '../utils/elementLabel'
import { newAnimation } from '../utils/newAnimation'

interface AnimationsTabProps {
  slide: DeckSlide
  selected: DeckElement | undefined
  onSelect: (elementId: string) => void
  change: (action: DeckAction, merge?: string) => void
  onPreview: () => void
  previewing: boolean
}

/**
 * The Animations tab: the slide's effects in play order (drag to reorder),
 * an effect added to the selected element, and Preview, which plays the slide
 * in the canvas.
 */
export function AnimationsTab({
  slide,
  selected,
  onSelect,
  change,
  onPreview,
  previewing,
}: AnimationsTabProps) {
  const { t } = useTranslation('schedules')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  const entries = slideTimeline(slide).flat()
  const ids = entries.map((e) => e.animation.id)
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    change({
      type: 'animation/move',
      slideId: slide.id,
      from: ids.indexOf(String(active.id)),
      to: ids.indexOf(String(over.id)),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="deck-editor-add-animation"
          disabled={!selected}
          onClick={() =>
            selected &&
            change({
              type: 'animation/add',
              slideId: slide.id,
              elementId: selected.id,
              animation: newAnimation(),
            })
          }
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={14} />
          {t('deckEditor.animations.add')}
        </button>
        <button
          type="button"
          data-testid="deck-editor-preview"
          disabled={previewing}
          onClick={onPreview}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <Play size={14} />
          {t('deckEditor.animations.preview')}
        </button>
      </div>
      {!selected && entries.length === 0 && (
        <p className="text-sm text-gray-500">
          {t('deckEditor.animations.selectFirst')}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {entries.map(({ elementId, animation }, index) => {
              const element = slide.elements.find((e) => e.id === elementId)
              return (
                <AnimationRow
                  key={animation.id}
                  animation={animation}
                  index={index}
                  target={element ? elementLabel(element, t) : elementId}
                  selected={elementId === selected?.id}
                  onSelect={() => onSelect(elementId)}
                  update={(patch, merge) =>
                    change(
                      {
                        type: 'animation/update',
                        slideId: slide.id,
                        animationId: animation.id,
                        patch,
                      },
                      merge,
                    )
                  }
                  onRemove={() =>
                    change({
                      type: 'animation/remove',
                      slideId: slide.id,
                      animationId: animation.id,
                    })
                  }
                />
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}
