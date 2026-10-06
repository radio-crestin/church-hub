/**
 * The factory transitions, the same for every text element on every screen:
 * soft fades only (no motion), eased at both ends, so text breathes in and out
 * instead of blinking. A slide change fades the old text out, then the new text
 * in (0.7 s in all); showing and hiding the presentation is a little slower.
 *
 * The client falls back to the same values (presentation/utils/calmTransitions.ts).
 */
export function calmTransitions() {
  return {
    animationIn: calmFade(600),
    animationOut: calmFade(500),
    slideTransitionIn: calmFade(400),
    slideTransitionOut: calmFade(300),
  }
}

function calmFade(duration: number) {
  return { type: 'fade', duration, delay: 0, easing: 'ease-in-out' }
}
