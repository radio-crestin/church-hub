import type { DeckBoxSize } from './resizeBox'
import type { DeckGuide } from '../types'

/** The lines of a box a guide can meet: its start, centre and end. */
function lines(start: number, size: number): number[] {
  return [start, start + size / 2, start + size]
}

/** The smallest shift (within `threshold`) that puts one of `own` on a target. */
function nearest(own: number[], targets: number[], threshold: number) {
  let best: { shift: number; at: number } | null = null
  for (const line of own) {
    for (const target of targets) {
      const shift = target - line
      if (
        Math.abs(shift) <= threshold &&
        (!best || Math.abs(shift) < Math.abs(best.shift))
      ) {
        best = { shift, at: target }
      }
    }
  }
  return best
}

/**
 * A moved box pulled onto the slide's edges and centre and the other
 * elements' edges and centres when within `threshold` design pixels, with
 * the guide lines it met.
 */
export function snapBox(
  box: DeckBoxSize,
  others: DeckBoxSize[],
  slide: { width: number; height: number },
  threshold: number,
): { box: DeckBoxSize; guides: DeckGuide[] } {
  const xs = [
    0,
    slide.width / 2,
    slide.width,
    ...others.flatMap((o) => lines(o.x, o.w)),
  ]
  const ys = [
    0,
    slide.height / 2,
    slide.height,
    ...others.flatMap((o) => lines(o.y, o.h)),
  ]
  const snapX = nearest(lines(box.x, box.w), xs, threshold)
  const snapY = nearest(lines(box.y, box.h), ys, threshold)
  const guides: DeckGuide[] = []
  if (snapX) guides.push({ axis: 'x', at: snapX.at })
  if (snapY) guides.push({ axis: 'y', at: snapY.at })
  return {
    box: {
      ...box,
      x: box.x + (snapX?.shift ?? 0),
      y: box.y + (snapY?.shift ?? 0),
    },
    guides,
  }
}
