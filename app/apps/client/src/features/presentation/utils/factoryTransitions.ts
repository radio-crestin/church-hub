import type { AnimationConfig } from '../types'

function fade(duration: number): AnimationConfig {
  return { type: 'fade', duration, delay: 0, easing: 'ease-in-out' }
}

/**
 * The main projection's factory transitions: a short eased dissolve, smooth
 * but quick, so a slide shows right away. A slide change crossfades (the new
 * text fades in while the old one fades out). Elements whose config has no
 * transition of their own use these. Same values as the server's factory
 * design for the main projection, which also has the stage and livestream
 * ones (apps/server/src/service/presentation/default-design/factoryTransitions.ts).
 */
export const FACTORY_TRANSITIONS = {
  animationIn: fade(300),
  animationOut: fade(250),
  slideTransitionIn: fade(300),
  slideTransitionOut: fade(300),
} as const
