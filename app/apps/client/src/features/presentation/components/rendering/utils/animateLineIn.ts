import { getAnimationStyles } from './getAnimationStyles'
import { FACTORY_TRANSITIONS } from '../../../utils/factoryTransitions'
import type { SlideAnimationConfig } from '../useSlideAnimation'

/**
 * Plays the slide's enter transition on one line that a slide change brought
 * in. Returns the animation, or null when the transition is "none".
 */
export function animateLineIn(
  line: HTMLElement,
  config: SlideAnimationConfig,
): Animation | null {
  const type = config.type ?? 'fade'
  if (type === 'none') return null
  const { start, end } = getAnimationStyles(type)
  return line.animate([start as Keyframe, end as Keyframe], {
    duration: config.duration ?? FACTORY_TRANSITIONS.slideTransitionIn.duration,
    easing: config.easing ?? 'ease-out',
  })
}
