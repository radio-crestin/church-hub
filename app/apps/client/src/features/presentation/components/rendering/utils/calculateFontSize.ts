import { measureTextHeight } from './measureTextHeight'

/**
 * Fitted sizes are whole multiples of 1/FIT_STEPS_PER_PX px. Whole pixels are
 * too coarse for a scaled-down preview: at a fifth of the screen's size one
 * pixel is five on the screen, so the preview's text came out up to a pixel
 * smaller than the projection's, scaled — visibly so in a small preview, and
 * enough to break its lines differently. Both engines lay text out at
 * fractional sizes, so a tenth of a pixel keeps every preview to scale.
 */
export const FIT_STEPS_PER_PX = 10

/**
 * Calculate font size to fit text in a container using binary search.
 * Sets the element to the target width and finds the largest font that fits in
 * height. Shared by the read-only renderer (AnimatedText) and the in-place slide
 * editor (EditableMainText) so the editing caret text matches the projected size.
 */
export function calculateFontSize(
  element: HTMLElement,
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
  minFontSize: number,
): number {
  if (!text || maxWidth <= 0 || maxHeight <= 0) {
    return maxFontSize
  }

  // Save original styles
  const originalStyles = {
    fontSize: element.style.fontSize,
    width: element.style.width,
    height: element.style.height,
    overflow: element.style.overflow,
    whiteSpace: element.style.whiteSpace,
    visibility: element.style.visibility,
    wordWrap: element.style.wordWrap,
  }

  // Set up for measurement - use target width so text wraps correctly
  element.style.width = `${maxWidth}px`
  element.style.height = 'auto'
  element.style.overflow = 'visible'
  element.style.whiteSpace = 'pre-wrap'
  element.style.wordWrap = 'break-word'
  element.style.visibility = 'hidden'
  element.textContent = text

  // Binary search, in fit steps, for the largest font size that fits
  let low = Math.ceil(minFontSize * FIT_STEPS_PER_PX)
  let high = Math.floor(maxFontSize * FIT_STEPS_PER_PX)
  let bestFit = minFontSize

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const size = mid / FIT_STEPS_PER_PX
    element.style.fontSize = `${size}px`

    // Measure height at this font size
    const contentHeight = measureTextHeight(element)

    if (contentHeight <= maxHeight) {
      // This font size fits, try larger
      bestFit = size
      low = mid + 1
    } else {
      // Too big, try smaller
      high = mid - 1
    }
  }

  // Restore original styles
  element.style.fontSize = originalStyles.fontSize
  element.style.width = originalStyles.width
  element.style.height = originalStyles.height
  element.style.overflow = originalStyles.overflow
  element.style.whiteSpace = originalStyles.whiteSpace
  element.style.wordWrap = originalStyles.wordWrap
  element.style.visibility = originalStyles.visibility

  return bestFit
}
