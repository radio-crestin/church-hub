import { TYPEWRITER_DURATION } from '../../../utils/typewriterDuration'
import type { SlideAnimationConfig } from '../useSlideAnimation'

/** A layer typing its text in. */
export interface LayerTypewriter<T> {
  /** The longest the typing may take: the enter animation's duration */
  maxDurationMs: number
  /** The slide this one replaced, whose words need no typing again */
  replaces?: T
}

interface LayerTypewriterOptions<T> {
  /** The animation the layer's text came in with */
  enter: SlideAnimationConfig
  /** Its enter animation is under way (or about to start) */
  entering: boolean
  /** It is shown, after a slide change that morphed it in place */
  morphed: boolean
  replaces?: T
}

/**
 * Whether the current layer types its text in: while a typewriter enter runs,
 * or after a morph whose slide change types. Null shows the whole text: once
 * the enter ended, while the slide leaves, or while the screen hides.
 */
export function layerTypewriter<T>({
  enter,
  entering,
  morphed,
  replaces,
}: LayerTypewriterOptions<T>): LayerTypewriter<T> | null {
  if (enter.type !== 'typewriter' || !(entering || morphed)) return null
  return {
    maxDurationMs: enter.duration ?? TYPEWRITER_DURATION.default,
    replaces,
  }
}
