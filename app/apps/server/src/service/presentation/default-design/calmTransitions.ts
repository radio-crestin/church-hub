/**
 * The factory transitions, the same for every text element on every screen:
 * fades only (no motion), eased at both ends, smooth but short so a slide shows
 * right away. A slide change crossfades: the new text fades in while the old
 * one fades out (0.25 s). Showing text fades it in over 0.25 s, hiding fades it
 * out over 0.2 s; a change of content type (a song, then a verse) does both.
 *
 * The client falls back to the same values (presentation/utils/calmTransitions.ts).
 */
export function calmTransitions() {
  return {
    animationIn: calmFade(250),
    animationOut: calmFade(200),
    slideTransitionIn: calmFade(250),
    slideTransitionOut: calmFade(250),
  }
}

function calmFade(duration: number) {
  return { type: 'fade', duration, delay: 0, easing: 'ease-in-out' }
}
