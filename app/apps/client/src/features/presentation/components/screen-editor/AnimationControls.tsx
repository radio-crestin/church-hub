import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox/Combobox'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import type { AnimationConfig } from '../../types'
import { FACTORY_TRANSITIONS } from '../../utils/factoryTransitions'
import { TYPEWRITER_DURATION } from '../../utils/typewriterDuration'

export const ANIMATION_TYPES = [
  { value: 'none', labelKey: 'screens.animation.types.none' },
  { value: 'fade', labelKey: 'screens.animation.types.fade' },
  { value: 'slide-left', labelKey: 'screens.animation.types.slideLeft' },
  { value: 'slide-right', labelKey: 'screens.animation.types.slideRight' },
  { value: 'slide-up', labelKey: 'screens.animation.types.slideUp' },
  { value: 'slide-down', labelKey: 'screens.animation.types.slideDown' },
  { value: 'zoom', labelKey: 'screens.animation.types.zoom' },
  { value: 'blur', labelKey: 'screens.animation.types.blur' },
] as const

/** Only how a text comes in can type it; it leaves like any other. */
const TYPEWRITER_TYPE = {
  value: 'typewriter',
  labelKey: 'screens.animation.types.typewriter',
} as const

/** The four transitions of an element, in the order they play. */
const ANIMATION_KEYS = [
  { key: 'animationIn', described: false, enters: true },
  { key: 'slideTransitionOut', described: true, enters: false },
  { key: 'slideTransitionIn', described: true, enters: true },
  { key: 'animationOut', described: false, enters: false },
] as const

export type AnimationKey = (typeof ANIMATION_KEYS)[number]['key']

interface AnimationControlsProps {
  config: Partial<Record<AnimationKey, AnimationConfig>>
  onChange: (key: AnimationKey, animation: AnimationConfig) => void
  portalContainer?: HTMLElement | null
}

/**
 * The animation as another type. Typing takes seconds where a fade takes a
 * fraction of one, so a switch to or from the typewriter starts from that
 * type's own duration.
 */
function withType(
  animation: AnimationConfig,
  type: AnimationConfig['type'],
  key: AnimationKey,
): AnimationConfig {
  const typing = type === 'typewriter'
  if (typing === (animation.type === 'typewriter')) {
    return { ...animation, type }
  }
  const duration = typing
    ? TYPEWRITER_DURATION.default
    : FACTORY_TRANSITIONS[key].duration
  return { ...animation, type, duration }
}

/**
 * How an element appears, changes between slides and leaves. An element
 * saved without a transition shows the factory one, as the screen plays it.
 */
export function AnimationControls({
  config,
  onChange,
  portalContainer,
}: AnimationControlsProps) {
  const { t } = useTranslation('presentation')
  const optionsFor = (enters: boolean) =>
    [...ANIMATION_TYPES, ...(enters ? [TYPEWRITER_TYPE] : [])].map(
      ({ value, labelKey }) => ({ value, label: t(labelKey) }),
    )

  return (
    <div className="space-y-4">
      {ANIMATION_KEYS.map(({ key, described, enters }, index) => {
        const animation = config[key] ?? FACTORY_TRANSITIONS[key]
        const types = animation.type === 'typewriter'
        return (
          <div
            key={key}
            className={index > 0 ? 'pt-3 border-t border-line' : ''}
          >
            <Label className="text-xs text-fg-label mb-1 block">
              {t(`screens.animation.${key}`)}
            </Label>
            {described && (
              <p className="text-xs text-fg-hint mb-2">
                {t(`screens.animation.${key}Description`)}
              </p>
            )}
            <Combobox
              value={animation.type}
              onChange={(value) =>
                onChange(
                  key,
                  withType(animation, value as AnimationConfig['type'], key),
                )
              }
              options={optionsFor(enters)}
              className="w-full mb-2"
              portalContainer={portalContainer}
            />
            <Label className="text-xs text-fg-label">
              {t(
                types
                  ? 'screens.animation.typingMs'
                  : 'screens.animation.durationMs',
              )}
            </Label>
            <Slider
              value={[animation.duration]}
              onValueChange={([duration]) =>
                onChange(key, { ...animation, duration })
              }
              min={types ? TYPEWRITER_DURATION.min : 0}
              max={types ? TYPEWRITER_DURATION.max : 1000}
              step={types ? TYPEWRITER_DURATION.step : 50}
            />
          </div>
        )
      })}
    </div>
  )
}
