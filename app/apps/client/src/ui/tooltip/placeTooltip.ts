export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface Size {
  width: number
  height: number
}

export interface TooltipPlacement {
  side: TooltipSide
  top: number
  left: number
  /** Where the arrow sits along the tooltip's edge, in px from its start. */
  arrowOffset: number
}

/** Space between the trigger and the tooltip. */
const GAP = 8
/** Space kept between the tooltip and the window's edges. */
const MARGIN = 8
/** The arrow never sits closer than this to a rounded corner. */
const ARROW_INSET = 10

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function isVertical(side: TooltipSide) {
  return side === 'top' || side === 'bottom'
}

/** Room between the trigger and the window edge on that side. */
function roomOn(side: TooltipSide, trigger: Rect, viewport: Size) {
  switch (side) {
    case 'top':
      return trigger.top - GAP - MARGIN
    case 'bottom':
      return viewport.height - (trigger.top + trigger.height) - GAP - MARGIN
    case 'left':
      return trigger.left - GAP - MARGIN
    case 'right':
      return viewport.width - (trigger.left + trigger.width) - GAP - MARGIN
  }
}

/** The side asked for, or its opposite when only that one has room. */
function chooseSide(
  preferred: TooltipSide,
  trigger: Rect,
  tooltip: Size,
  viewport: Size,
) {
  const needed = isVertical(preferred) ? tooltip.height : tooltip.width
  const opposite = OPPOSITE[preferred]
  const preferredRoom = roomOn(preferred, trigger, viewport)
  if (preferredRoom >= needed) return preferred
  const oppositeRoom = roomOn(opposite, trigger, viewport)
  return oppositeRoom > preferredRoom ? opposite : preferred
}

/**
 * Places a tooltip beside its trigger and inside the window: it flips to the
 * other side when the asked-for one has no room, slides along the trigger to
 * stay clear of the edges, and keeps its arrow on the trigger's centre.
 */
export function placeTooltip(
  preferred: TooltipSide,
  trigger: Rect,
  tooltip: Size,
  viewport: Size,
): TooltipPlacement {
  const side = chooseSide(preferred, trigger, tooltip, viewport)
  const centerX = trigger.left + trigger.width / 2
  const centerY = trigger.top + trigger.height / 2
  const maxLeft = viewport.width - MARGIN - tooltip.width
  const maxTop = viewport.height - MARGIN - tooltip.height

  if (isVertical(side)) {
    const top =
      side === 'top'
        ? trigger.top - GAP - tooltip.height
        : trigger.top + trigger.height + GAP
    const left = clamp(centerX - tooltip.width / 2, MARGIN, maxLeft)
    return {
      side,
      top: clamp(top, MARGIN, maxTop),
      left,
      arrowOffset: clamp(
        centerX - left,
        ARROW_INSET,
        tooltip.width - ARROW_INSET,
      ),
    }
  }

  const left =
    side === 'left'
      ? trigger.left - GAP - tooltip.width
      : trigger.left + trigger.width + GAP
  const top = clamp(centerY - tooltip.height / 2, MARGIN, maxTop)
  return {
    side,
    top,
    left: clamp(left, MARGIN, maxLeft),
    arrowOffset: clamp(
      centerY - top,
      ARROW_INSET,
      tooltip.height - ARROW_INSET,
    ),
  }
}
