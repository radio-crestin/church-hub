import { promoteWhileAnimating } from './promoteWhileAnimating'

/** Strong ease-in-out: the curve for something moving on screen. */
const GLIDE_EASING = 'cubic-bezier(0.77, 0, 0.175, 1)'

export interface Shift {
  x: number
  y: number
}

/**
 * Moves a kept line or word from where it was drawn to its new place, when
 * the slide change moved it (a line added above it, a word before it changing
 * width, a wrap): it glides back from `from` instead of jumping. Composite
 * only: a `transform` on the Web Animations API, so it runs off the main
 * thread. The caller measures every element first (glideFrom), then starts
 * every glide, so no glide forces a layout or style read.
 *
 * @param running the element's glide still under way, replaced here
 * @param from the offset the element starts from, relative to its new place
 */
export function glideIntoPlace(
  element: HTMLElement,
  running: Animation | undefined,
  from: Shift,
  duration: number,
): Animation {
  running?.cancel()
  const animation = element.animate(
    [
      { transform: `translate(${from.x}px, ${from.y}px)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration, easing: GLIDE_EASING },
  )
  promoteWhileAnimating(element, animation, 'transform')
  return animation
}
