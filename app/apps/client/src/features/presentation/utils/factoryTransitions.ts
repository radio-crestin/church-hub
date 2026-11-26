import type { AnimationConfig, EasingType } from '../types'

/** Strong ease-out: text arrives quickly and settles softly. */
export const EASE_ENTER: EasingType = 'cubic-bezier(0.23, 1, 0.32, 1)'
/** Gentle ease-in: text leaving the screen eases away, then goes. */
export const EASE_EXIT: EasingType = 'cubic-bezier(0.32, 0, 0.67, 0)'

function fade(duration: number, easing: EasingType): AnimationConfig {
  return { type: 'fade', duration, delay: 0, easing }
}

/**
 * The main projection's factory transitions, a calm dissolve: text fades in
 * over 450 ms on a strong ease-out and fades out over 400 ms on a gentle
 * ease-in when the presentation ends. A slide change crossfades: the new text
 * eases in over 400 ms while the old one leaves a little faster (350 ms) on
 * the same ease-out, so the two never sit on top of each other for long.
 * Elements whose config has no transition of their own use these. Same values
 * as the server's factory design for the main projection, which also has the
 * stage and livestream ones (apps/server/src/service/presentation/default-design/factoryTransitions.ts).
 */
export const FACTORY_TRANSITIONS = {
  animationIn: fade(450, EASE_ENTER),
  animationOut: fade(400, EASE_EXIT),
  slideTransitionIn: fade(400, EASE_ENTER),
  slideTransitionOut: fade(350, EASE_ENTER),
} as const
