import { useTranslation } from 'react-i18next'

import { Combobox } from '~/ui/combobox/Combobox'
import { Label } from '~/ui/label/Label'
import { Slider } from '~/ui/slider/Slider'
import type { AnimationConfig } from '../../types'
import { FACTORY_TRANSITIONS } from '../../utils/factoryTransitions'

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

/** The four transitions of an element, in the order they play. */
const ANIMATION_KEYS = [
  { key: 'animationIn', described: false },
  { key: 'slideTransitionOut', described: true },
  { key: 'slideTransitionIn', described: true },
  { key: 'animationOut', described: false },
] as const

export type AnimationKey = (typeof ANIMATION_KEYS)[number]['key']

interface AnimationControlsProps {
  config: Partial<Record<AnimationKey, AnimationConfig>>
  onChange: (key: AnimationKey, animation: AnimationConfig) => void
  portalContainer?: HTMLElement | null
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
  const options = ANIMATION_TYPES.map(({ value, labelKey }) => ({
    value,
    label: t(labelKey),
  }))

  return (
    <div className="space-y-4">
      {ANIMATION_KEYS.map(({ key, described }, index) => {
        const animation = config[key] ?? FACTORY_TRANSITIONS[key]
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
                onChange(key, {
                  ...animation,
                  type: value as AnimationConfig['type'],
                })
              }
              options={options}
              className="w-full mb-2"
              portalContainer={portalContainer}
            />
            <Label className="text-xs text-fg-label">
              {t('screens.animation.durationMs')}
            </Label>
            <Slider
              value={[animation.duration]}
              onValueChange={([duration]) =>
                onChange(key, { ...animation, duration })
              }
              min={0}
              max={1000}
              step={50}
            />
          </div>
        )
      })}
    </div>
  )
}
