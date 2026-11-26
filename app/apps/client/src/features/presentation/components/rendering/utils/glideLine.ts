/** Strong ease-in-out: the curve for something moving on screen. */
const GLIDE_EASING = 'cubic-bezier(0.77, 0, 0.175, 1)'

/** The vertical offset a line's running glide has moved it by right now. */
function currentOffset(line: HTMLElement): number {
  const transform = getComputedStyle(line).transform
  return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
}

/**
 * Moves a shared line from where it was drawn to its new place, when a line
 * added or taken away above it (or a changed line wrapping differently) moves
 * it: it glides `shift` pixels instead of jumping. Interrupting a glide
 * starts the next one from where the line is now.
 *
 * @param running the line's glide still under way, cancelled here
 * @param shift how far the line moved down in the layout (old top - new top)
 */
export function glideLine(
  line: HTMLElement,
  running: Animation | undefined,
  shift: number,
  duration: number,
): Animation | null {
  const from = shift + (running ? currentOffset(line) : 0)
  running?.cancel()
  if (Math.abs(from) < 0.5) return null
  return line.animate(
    [{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }],
    { duration, easing: GLIDE_EASING },
  )
}
