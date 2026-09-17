interface CountFittingActionsInput {
  /** Rendered width of each action, in the order they sit in the row. */
  actionWidths: number[]
  /** Width of the "More" trigger that takes over whatever does not fit. */
  moreWidth: number
  /** Room the actions may use, the "More" trigger included. */
  available: number
  /** Gap between two neighbouring controls. */
  gap: number
}

// Widths come from getBoundingClientRect and carry fractions; without some
// slack a row that fits exactly could flip back and forth on rounding alone.
const SUBPIXEL_TOLERANCE = 0.5

/**
 * How many actions, counted from the start of the row, stay inline.
 *
 * All of them when they fit side by side. Otherwise as many as still leave
 * room for the "More" trigger after them — so the rightmost actions are the
 * first to move into the menu, and the trigger itself is never pushed out.
 */
export function countFittingActions({
  actionWidths,
  moreWidth,
  available,
  gap,
}: CountFittingActionsInput): number {
  const limit = available + SUBPIXEL_TOLERANCE
  const allWidth =
    actionWidths.reduce((sum, width) => sum + width, 0) +
    gap * Math.max(0, actionWidths.length - 1)
  if (allWidth <= limit) return actionWidths.length

  let used = moreWidth
  let count = 0
  for (const width of actionWidths) {
    used += width + gap
    if (used > limit) break
    count++
  }
  return count
}
