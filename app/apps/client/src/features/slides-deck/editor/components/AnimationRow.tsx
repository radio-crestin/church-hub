import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NumberField } from './NumberField'
import {
  DECK_ANIMATION_EFFECTS,
  DECK_ANIMATION_KINDS,
  DECK_DIRECTIONS,
  DECK_TRIGGERS,
  type DeckAnimation,
} from '../../types'
import {
  ANIMATION_DEFAULT_DIRECTIONS,
  animationDirection,
} from '../../utils/animationDirection'

const SELECT =
  'w-full rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white'

interface AnimationRowProps {
  animation: DeckAnimation
  index: number
  /** What it moves, as the list names it. */
  target: string
  selected: boolean
  onSelect: () => void
  update: (patch: Partial<DeckAnimation>, merge?: string) => void
  onRemove: () => void
}

/** One effect of the slide's timeline: what it moves and how, dragged to its turn. */
export function AnimationRow({
  animation,
  index,
  target,
  selected,
  onSelect,
  update,
  onRemove,
}: AnimationRowProps) {
  const { t } = useTranslation('schedules')
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: animation.id,
    })
  const direction = animationDirection(animation.effect, animation.direction)
  const select = <T extends string>(
    field: keyof DeckAnimation,
    values: readonly T[],
    label: (value: T) => string,
    value = animation[field] as T,
  ) => (
    <select
      data-testid={`deck-editor-animation-${field}`}
      value={value}
      onChange={(e) =>
        update(
          field === 'effect'
            ? {
                // A side of its own from the start: what it plays is what shows.
                effect: e.target.value as DeckAnimation['effect'],
                direction: animationDirection(
                  e.target.value as DeckAnimation['effect'],
                  direction,
                ),
              }
            : { [field]: e.target.value },
        )
      }
      className={SELECT}
      aria-label={t(`deckEditor.animations.${field}`)}
    >
      {values.map((value) => (
        <option key={value} value={value}>
          {label(value)}
        </option>
      ))}
    </select>
  )
  return (
    <li
      ref={setNodeRef}
      data-testid="deck-editor-animation"
      data-animation-id={animation.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-1.5 rounded-lg border p-2 ${
        selected
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="cursor-grab touch-none text-gray-400"
          data-testid="deck-editor-animation-grip"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </span>
        <span className="text-xs font-semibold text-gray-500">{index + 1}</span>
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 truncate text-left text-sm text-gray-800 dark:text-gray-100"
        >
          {target}
        </button>
        <button
          type="button"
          data-testid="deck-editor-animation-remove"
          title={t('deckEditor.animations.remove')}
          aria-label={t('deckEditor.animations.remove')}
          onClick={onRemove}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {select('kind', DECK_ANIMATION_KINDS, (v) =>
          t(`deckEditor.animations.kinds.${v}`),
        )}
        {select('effect', DECK_ANIMATION_EFFECTS, (v) =>
          t(`deckEditor.animations.effects.${v}`),
        )}
        {select('trigger', DECK_TRIGGERS, (v) =>
          t(`deckEditor.animations.triggers.${v}`),
        )}
        {animation.effect in ANIMATION_DEFAULT_DIRECTIONS &&
          select(
            'direction',
            DECK_DIRECTIONS,
            (v) => t(`deckEditor.directions.${v}`),
            direction,
          )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField
          label={t('deckEditor.animations.delay')}
          value={animation.delayMs / 1000}
          min={0}
          step={0.1}
          onChange={(s) =>
            update({ delayMs: Math.round(s * 1000) }, `delay:${animation.id}`)
          }
        />
        <NumberField
          label={t('deckEditor.animations.duration')}
          value={animation.durationMs / 1000}
          min={0}
          step={0.1}
          onChange={(s) =>
            update(
              { durationMs: Math.round(s * 1000) },
              `duration:${animation.id}`,
            )
          }
        />
      </div>
    </li>
  )
}
