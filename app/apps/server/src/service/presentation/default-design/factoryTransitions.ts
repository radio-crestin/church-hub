import type { ScreenType } from '../types'

function fade(duration: number) {
  return { type: 'fade', duration, delay: 0, easing: 'ease-in-out' }
}

function cut() {
  return { type: 'none', duration: 0, delay: 0, easing: 'ease-in-out' }
}

/** How a screen's text shows, hides and changes from slide to slide. */
function transitions(show: number, hide: number, slideChange: number) {
  return {
    animationIn: fade(show),
    animationOut: fade(hide),
    // A slide change crossfades: the new text fades in while the old one
    // fades out, so there is never a blank screen between slides.
    slideTransitionIn: fade(slideChange),
    slideTransitionOut: fade(slideChange),
  }
}

/**
 * The factory transitions of each screen type, the same for every text
 * element on it (T-158, after ProPresenter / FreeShow defaults and church
 * production practice):
 * - main projection and kiosk: a 300 ms eased dissolve, hiding a little
 *   faster (250 ms), as practitioners use 0.3-0.4 s fades on lyrics;
 * - stage display: cuts, so the singers read the next line the moment it is
 *   sent;
 * - livestream overlay: a tighter 250 ms dissolve, 200 ms to hide, as a
 *   broadcast lower third should be.
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
      return transitions(250, 200, 250)
    default:
      return transitions(300, 250, 300)
  }
}
