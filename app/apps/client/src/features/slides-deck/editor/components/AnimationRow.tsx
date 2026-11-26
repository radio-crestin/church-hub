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
  'h-8 w-full rounded-[10px] border-0 bg-field px-2 text-base md:text-sm text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus'

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
        selected ? 'border-line-strong bg-selected' : 'border-line'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="cursor-grab touch-none text-fg-hint"
          data-testid="deck-editor-animation-grip"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={1.75} />
        </span>
        <span className="text-xs font-semibold tabular-nums text-fg-hint">
          {index + 1}
        </span>
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-fg-body"
        >
          {target}
        </button>
        <button
          type="button"
          data-testid="deck-editor-animation-remove"
          title={t('deckEditor.animations.remove')}
          aria-label={t('deckEditor.animations.remove')}
          onClick={onRemove}
          className="rounded-lg p-1 text-fg-label hover:bg-hover hover:text-red-600"
        >
          <Trash2 size={14} strokeWidth={1.75} />
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
