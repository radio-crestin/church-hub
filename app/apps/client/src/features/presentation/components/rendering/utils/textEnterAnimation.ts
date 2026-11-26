import {
  ANIMATED_ELEMENTS,
  totalDuration,
} from './calculateMaxExitAnimationDuration'
import type { AnimationConfig, ContentTypeConfig } from '../../../types'
import { FACTORY_TRANSITIONS } from '../../../utils/factoryTransitions'

/**
 * How the text of `config` comes on screen: the slowest text element's
 * entrance (duration + delay), or the factory one. An element without its own
 * entrance fades in with the factory one, as AnimatedText does.
 */
export function textEnterAnimation(
  config: ContentTypeConfig | undefined,
): AnimationConfig {
  const entrances = ANIMATED_ELEMENTS.flatMap((name) => {
    const element = (
      config as unknown as Record<string, unknown> | undefined
    )?.[name] as { animationIn?: AnimationConfig } | undefined
    return element
      ? [element.animationIn ?? FACTORY_TRANSITIONS.animationIn]
      : []
  })
  if (entrances.length === 0) return FACTORY_TRANSITIONS.animationIn
  return entrances.reduce((slowest, entrance) =>
    totalDuration(entrance) > totalDuration(slowest) ? entrance : slowest,
  )
}
