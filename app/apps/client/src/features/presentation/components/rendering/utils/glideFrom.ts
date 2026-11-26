import type { Shift } from './glideIntoPlace'

/** How far an element's running glide has moved it right now. */
function runningOffset(element: HTMLElement): Shift {
  const transform = getComputedStyle(element).transform
  if (transform === 'none') return { x: 0, y: 0 }
  const matrix = new DOMMatrixReadOnly(transform)
  return { x: matrix.m41, y: matrix.m42 }
}

/**
 * Where a kept element's glide starts, relative to its new place: how far the
 * layout moved it, plus where a glide still under way has it now (so an
 * interrupted glide carries on from there). Null when it doesn't need to
 * move: re-centring a line by a sliver of a glyph (a "1" becoming a "2")
 * isn't worth motion, so shifts under `minimum` snap. Reads only; the
 * glides start once everything is measured.
 *
 * @param moved old place - new place in the layout
 */
export function glideFrom(
  element: HTMLElement,
  running: Animation | undefined,
  moved: Shift,
  minimum: number,
): Shift | null {
  const now = running ? runningOffset(element) : { x: 0, y: 0 }
  const from = { x: moved.x + now.x, y: moved.y + now.y }
  return Math.hypot(from.x, from.y) < minimum ? null : from
}
