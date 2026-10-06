import type { AnimationConfig, ContentTypeConfig } from '../../../types'
import { CALM_TRANSITIONS } from '../../../utils/calmTransitions'

const ANIMATED_ELEMENTS = [
  'mainText',
  'contentText',
  'referenceText',
  'personLabel',
] as const

function totalDuration(animation: AnimationConfig): number {
  if (animation.type === 'none') return 0
  return animation.duration + (animation.delay ?? 0)
}

/**
 * How long the slowest text element of `config` takes to fade out when the
 * presentation is hidden (duration + delay, in ms). An element without its own
 * exit animation fades out with the factory one, as AnimatedText does.
 */
export function calculateMaxExitAnimationDuration(
  config: ContentTypeConfig | undefined,
): number {
  if (!config) return 0
  const durations = ANIMATED_ELEMENTS.flatMap((name) => {
    const element = (config as unknown as Record<string, unknown>)[name] as
      | { animationOut?: AnimationConfig }
      | undefined
    if (!element) return []
    return [
      totalDuration(element.animationOut ?? CALM_TRANSITIONS.animationOut),
    ]
  })
  return durations.length > 0 ? Math.max(...durations) : 0
}
