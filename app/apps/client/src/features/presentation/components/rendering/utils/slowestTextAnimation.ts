import {
  ANIMATED_ELEMENTS,
  totalDuration,
} from './calculateMaxExitAnimationDuration'
import type { AnimationConfig, ContentTypeConfig } from '../../../types'
import { FACTORY_TRANSITIONS } from '../../../utils/factoryTransitions'

type TextAnimation = 'animationIn' | 'animationOut'

/**
 * How the text of `config` comes on screen (animationIn) or leaves it
 * (animationOut): the slowest text element's animation (duration + delay), or
 * the factory one. An element without its own animation uses the factory one,
 * as AnimatedText does.
 */
export function slowestTextAnimation(
  config: ContentTypeConfig | undefined,
  animation: TextAnimation,
): AnimationConfig {
  const animations = ANIMATED_ELEMENTS.flatMap((name) => {
    const element = (
      config as unknown as Record<string, unknown> | undefined
    )?.[name] as Partial<Record<TextAnimation, AnimationConfig>> | undefined
    return element ? [element[animation] ?? FACTORY_TRANSITIONS[animation]] : []
  })
  if (animations.length === 0) return FACTORY_TRANSITIONS[animation]
  return animations.reduce((slowest, next) =>
    totalDuration(next) > totalDuration(slowest) ? next : slowest,
  )
}
