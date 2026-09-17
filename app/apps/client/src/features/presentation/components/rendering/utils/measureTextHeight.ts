/**
 * Laid-out height of the hidden element a fit measures text with, to the
 * sub-pixel.
 *
 * `scrollHeight` is rounded to whole pixels, which is a sizeable share of a box
 * a small preview draws only a few pixels tall: the fit there came out several
 * percent off the projection's. A bounding rectangle is not rounded but shrinks
 * with any transform an entrance animation puts around the text. The computed
 * height is neither. An element that is not laid out (inside a hidden panel)
 * has no computed height to read, and keeps `scrollHeight`.
 */
export function measureTextHeight(element: HTMLElement): number {
  const height = Number.parseFloat(getComputedStyle(element).height)
  return Number.isFinite(height) ? height : element.scrollHeight
}
