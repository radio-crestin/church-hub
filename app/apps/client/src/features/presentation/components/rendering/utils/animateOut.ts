import { getAnimationStyles } from './getAnimationStyles'
import { promoteWhileAnimating } from './promoteWhileAnimating'
import { FACTORY_TRANSITIONS } from '../../../utils/factoryTransitions'
import type { SlideAnimationConfig } from '../useSlideAnimation'

/**
 * Plays the slide's exit transition on one line or word a slide change took
 * away, from the opacity it had (one still fading in leaves from where it
 * got to, never jumping back to full), and holds it hidden at the end.
 */
export function animateOut(
  element: HTMLElement,
  config: SlideAnimationConfig,
  fromOpacity: number,
): void {
  const { start, end } = getAnimationStyles(config.type ?? 'fade')
  const animation = element.animate(
    [{ ...end, opacity: fromOpacity } as Keyframe, start as Keyframe],
    {
      duration:
        config.duration ?? FACTORY_TRANSITIONS.slideTransitionOut.duration,
      easing: config.easing ?? 'ease-out',
      fill: 'forwards',
    },
  )
  promoteWhileAnimating(element, animation, 'opacity')
}
