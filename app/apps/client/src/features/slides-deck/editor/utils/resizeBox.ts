/** An element's box in design pixels. */
export interface DeckBoxSize {
  x: number
  y: number
  w: number
  h: number
}

export type DeckResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** No element is dragged smaller than this. */
const MIN_SIZE = 10

/**
 * The box `start` resized by dragging `handle` by `dx`,`dy` (design pixels,
 * along the box's own axes): the opposite side stays put; with `keepAspect`
 * (Shift) it keeps its shape, an edge handle growing the other side evenly.
 */
export function resizeBox(
  start: DeckBoxSize,
  handle: DeckResizeHandle,
  dx: number,
  dy: number,
  keepAspect: boolean,
): DeckBoxSize {
  const east = handle.includes('e')
  const west = handle.includes('w')
  const north = handle.includes('n')
  const south = handle.includes('s')
  let w = Math.max(MIN_SIZE, start.w + (east ? dx : west ? -dx : 0))
  let h = Math.max(MIN_SIZE, start.h + (south ? dy : north ? -dy : 0))
  const ratio = start.w / start.h
  if (keepAspect) {
    const horizontal = east || west
    const vertical = north || south
    if (horizontal && (!vertical || w / start.w > h / start.h)) h = w / ratio
    else w = h * ratio
  }
  const x = west
    ? start.x + start.w - w
    : east
      ? start.x
      : start.x + (start.w - w) / 2
  const y = north
    ? start.y + start.h - h
    : south
      ? start.y
      : start.y + (start.h - h) / 2
  return { x, y, w, h }
}
