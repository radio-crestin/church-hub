import type { ScreenType } from '../types'

/** Strong ease-out: text arrives quickly and settles softly. */
const EASE_ENTER = 'cubic-bezier(0.23, 1, 0.32, 1)'
/** Gentle ease-in: text leaving the screen eases away, then goes. */
const EASE_EXIT = 'cubic-bezier(0.32, 0, 0.67, 0)'

function fade(duration: number, easing: string) {
  return { type: 'fade', duration, delay: 0, easing }
}

function cut() {
  return { type: 'none', duration: 0, delay: 0, easing: 'ease-in-out' }
}

/** How a screen's text shows, hides and changes from slide to slide. */
function transitions(
  show: number,
  hide: number,
  slideIn: number,
  slideOut: number,
) {
  return {
    animationIn: fade(show, EASE_ENTER),
    animationOut: fade(hide, EASE_EXIT),
    // A slide change crossfades: the new text eases in while the old one
    // leaves a little faster on the same ease-out, so there is never a blank
    // screen between slides and the two never sit on top of each other long.
    slideTransitionIn: fade(slideIn, EASE_ENTER),
    slideTransitionOut: fade(slideOut, EASE_ENTER),
  }
}

/**
 * The factory transitions of each screen type, the same for every text
 * element on it (T-158, made calmer in #271):
 * - main projection and kiosk: a 450 ms dissolve in on a strong ease-out,
 *   400 ms out on a gentle ease-in when the presentation ends; a slide
 *   change eases the new text in over 400 ms while the old leaves in 350 ms;
 * - stage display: cuts, so the singers read the next line the moment it is
 *   sent;
 * - livestream overlay: tighter, as a broadcast lower third should be (350 ms
 *   in, 300 ms out, slide changes 350 / 300 ms).
 *
 * The client falls back to the main projection's values
 * (presentation/utils/factoryTransitions.ts).
 */
export function factoryTransitions(screenType: ScreenType) {
  switch (screenType) {
    case 'stage':
      return {
        animationIn: cut(),
        animationOut: cut(),
        slideTransitionIn: cut(),
        slideTransitionOut: cut(),
      }
    case 'livestream':
      return transitions(350, 300, 350, 300)
    default:
      return transitions(450, 400, 400, 350)
  }
}
