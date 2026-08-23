/**
 * Largest font size at or below `desired` that keeps the slide's text inside its
 * box.
 *
 * `calculateFontSize` measures the plain text at the screen's own size, so it
 * knows nothing about the two things that grow the text afterwards: the slide's
 * own font scale, which multiplies the fitted size, and an enlarged run, which
 * arrives as `font-size: Xem` markup the plain-text measurement never sees.
 * Either one pushes the words past the top and bottom of the box, where they are
 * cut off. Measuring the markup that is actually rendered catches both.
 *
 * Pass `Math.ceil(maxHeight)` as `desired` to ask the other question this answers
 * — the size at which the text exactly fills the box — which is the ceiling the
 * formatting bar needs to stop the operator at the edge of the screen.
 *
 * @param element hidden element used for measurement, sized to the box's width
 * @param text plain text of the slide, used when there is no styled markup
 * @param html the slide's styled markup, or null when the text carries no runs
 * @param desired the size to keep unless it overflows
 */
export function fitFontSizeToBounds(
  element: HTMLElement,
  text: string,
  html: string | null,
  desired: number,
  maxWidth: number,
  maxHeight: number,
  minFontSize: number,
): number {
  if (!text || maxWidth <= 0 || maxHeight <= 0 || desired <= 0) {
    return desired
  }

  const originalStyles = {
    fontSize: element.style.fontSize,
    width: element.style.width,
    height: element.style.height,
    overflow: element.style.overflow,
    whiteSpace: element.style.whiteSpace,
    visibility: element.style.visibility,
    wordWrap: element.style.wordWrap,
  }

  element.style.width = `${maxWidth}px`
  element.style.height = 'auto'
  element.style.overflow = 'visible'
  element.style.whiteSpace = 'pre-wrap'
  element.style.wordWrap = 'break-word'
  element.style.visibility = 'hidden'
  if (html === null) {
    element.textContent = text
  } else {
    element.innerHTML = html
  }

  const fits = (size: number): boolean => {
    element.style.fontSize = `${size}px`
    return element.scrollHeight <= maxHeight
  }

  let bestFit = desired
  if (!fits(desired)) {
    // Binary search the same way the plain-text fit does, so a bounded size and
    // a fitted one are always the same kind of number.
    let low = Math.ceil(minFontSize)
    let high = Math.floor(desired)
    bestFit = minFontSize
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (fits(mid)) {
        bestFit = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
  }

  element.style.fontSize = originalStyles.fontSize
  element.style.width = originalStyles.width
  element.style.height = originalStyles.height
  element.style.overflow = originalStyles.overflow
  element.style.whiteSpace = originalStyles.whiteSpace
  element.style.wordWrap = originalStyles.wordWrap
  element.style.visibility = originalStyles.visibility

  return bestFit
}
