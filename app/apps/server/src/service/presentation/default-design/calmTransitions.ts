/**
 * The factory transitions, the same for every text element on every screen:
 * soft fades only (no motion), eased at both ends, so text breathes in and out
 * instead of blinking. A slide change fades the old text out, then the new text
 * in (0.7 s in all). Showing text fades it in over 0.5 s, hiding fades it out
 * over 0.4 s; a change of content type (a song, then a verse) does both.
 *
 * The client falls back to the same values (presentation/utils/calmTransitions.ts).
 */
export function calmTransitions() {
  return {
    animationIn: calmFade(500),
    animationOut: calmFade(400),
    slideTransitionIn: calmFade(400),
    slideTransitionOut: calmFade(300),
  }
}

function calmFade(duration: number) {
  return { type: 'fade', duration, delay: 0, easing: 'ease-in-out' }
}
