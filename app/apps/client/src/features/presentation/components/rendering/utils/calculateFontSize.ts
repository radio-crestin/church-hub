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

  // Binary search for the largest font size that fits
  let low = minFontSize
  let high = maxFontSize
  let bestFit = minFontSize

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    element.style.fontSize = `${mid}px`

    // Measure height at this font size
    const contentHeight = element.scrollHeight

    if (contentHeight <= maxHeight) {
      // This font size fits, try larger
      bestFit = mid
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
