import type { AnimationConfig } from '../types'

function calmFade(duration: number): AnimationConfig {
  return { type: 'fade', duration, delay: 0, easing: 'ease-in-out' }
}

/**
 * The factory transitions: short eased fades, smooth but quick, so a slide
 * shows right away. A slide change crossfades (the new text fades in while the
 * old one fades out). Elements whose config has no transition of their own
 * use these. Same values as the server's factory design
 * (apps/server/src/service/presentation/default-design/calmTransitions.ts).
 */
export const CALM_TRANSITIONS = {
  animationIn: calmFade(250),
  animationOut: calmFade(200),
  slideTransitionIn: calmFade(250),
  slideTransitionOut: calmFade(250),
} as const
