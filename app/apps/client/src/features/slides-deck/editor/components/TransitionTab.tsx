import { useTranslation } from 'react-i18next'

import { NumberField } from './NumberField'
import { PanelField } from './PanelField'
import {
  DECK_DIRECTIONS,
  DECK_TRANSITION_EFFECTS,
  type DeckSlide,
  type DeckTransition,
} from '../../types'
import {
  TRANSITION_DEFAULT_DIRECTIONS,
  transitionDirection,
} from '../../utils/transitionDirection'
import type { DeckAction } from '../types'

const SELECT =
  'w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white'

interface TransitionTabProps {
  slide: DeckSlide
  change: (action: DeckAction, merge?: string) => void
}

/** How the slide comes in, and how long it stays when the presentation runs by itself. */
export function TransitionTab({ slide, change }: TransitionTabProps) {
  const { t } = useTranslation('schedules')
  const transition: DeckTransition = slide.transition ?? {
    effect: 'none',
    durationMs: 700,
  }
  const set = (patch: Partial<DeckSlide>, merge?: string) =>
    change({ type: 'slide/update', slideId: slide.id, patch }, merge)
  const setTransition = (patch: Partial<DeckTransition>, merge?: string) =>
    set({ transition: { ...transition, ...patch } }, merge)
  const direction = transitionDirection(transition.effect, transition.direction)
  const hasDirection = transition.effect in TRANSITION_DEFAULT_DIRECTIONS

  return (
    <div className="space-y-3">
      <PanelField label={t('deckEditor.transition.effect')}>
        <select
          data-testid="deck-editor-transition-effect"
          value={transition.effect}
          onChange={(e) =>
            setTransition({
              effect: e.target.value as DeckTransition['effect'],
              // A side of its own from the start: what it plays is what shows.
              direction: transitionDirection(
                e.target.value as DeckTransition['effect'],
                direction,
              ),
            })
          }
          className={SELECT}
        >
          {DECK_TRANSITION_EFFECTS.map((effect) => (
            <option key={effect} value={effect}>
              {t(`deckEditor.transition.effects.${effect}`)}
            </option>
          ))}
        </select>
      </PanelField>
      {hasDirection && (
        <PanelField label={t('deckEditor.direction')}>
          <select
            data-testid="deck-editor-transition-direction"
            value={direction}
            onChange={(e) =>
              setTransition({
                direction: e.target.value as DeckTransition['direction'],
              })
            }
            className={SELECT}
          >
            {DECK_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {t(`deckEditor.directions.${direction}`)}
              </option>
            ))}
          </select>
        </PanelField>
      )}
      {transition.effect !== 'none' && (
        <NumberField
          label={t('deckEditor.seconds')}
          value={transition.durationMs / 1000}
          min={0}
          max={60}
          step={0.1}
          onChange={(seconds) =>
            setTransition(
              { durationMs: Math.round(seconds * 1000) },
              `transition:${slide.id}`,
            )
          }
        />
      )}
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          data-testid="deck-editor-advance-after"
          checked={slide.advanceAfterMs != null}
          onChange={(e) =>
            set({ advanceAfterMs: e.target.checked ? 5000 : undefined })
          }
        />
        {t('deckEditor.transition.advanceAfter')}
      </label>
      {slide.advanceAfterMs != null && (
        <NumberField
          label={t('deckEditor.seconds')}
          value={slide.advanceAfterMs / 1000}
          min={0}
          step={0.5}
          onChange={(seconds) =>
            set(
              { advanceAfterMs: Math.round(seconds * 1000) },
              `advance:${slide.id}`,
            )
          }
        />
      )}
    </div>
  )
}
