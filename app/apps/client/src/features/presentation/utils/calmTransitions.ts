import type { AnimationConfig } from '../types'

function calmFade(duration: number): AnimationConfig {
  return { type: 'fade', duration, delay: 0, easing: 'ease-in-out' }
}

/**
 * The factory transitions: soft eased fades, so text breathes in and out
 * instead of blinking. Elements whose config has no transition of their own
 * use these. Same values as the server's factory design
 * (apps/server/src/service/presentation/default-design/calmTransitions.ts).
 */
export const CALM_TRANSITIONS = {
  animationIn: calmFade(600),
  animationOut: calmFade(500),
  slideTransitionIn: calmFade(400),
  slideTransitionOut: calmFade(300),
} as const
