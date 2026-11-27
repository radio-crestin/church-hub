import { largestFittingStep } from './largestFittingStep'
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
 * Calculate font size to fit text in a container (largestFittingStep).
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
  /**
   * The size this text box was last fitted to. The browser has the words it
   * keeps already shaped at that size, so a search that starts there measures
   * a slide that changed a few words without laying any text out from scratch.
   */
  lastFit: number | null = null,
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

  const low = Math.ceil(minFontSize * FIT_STEPS_PER_PX)
  const high = Math.floor(maxFontSize * FIT_STEPS_PER_PX)
  const heightAt = (step: number) => {
    element.style.fontSize = `${step / FIT_STEPS_PER_PX}px`
    return measureTextHeight(element)
  }
  const fits = (step: number) => heightAt(step) <= maxHeight
  let step: number
  if (lastFit !== null) {
    step = largestFittingStep(low, high, lastFit * FIT_STEPS_PER_PX, fits)
  } else {
    // The height at the largest size says which size the text would fill
    // exactly if it kept its line breaks: the search starts there.
    const highHeight = high >= low ? heightAt(high) : 0
    step =
      highHeight <= maxHeight
        ? high
        : largestFittingStep(
            low,
            high - 1,
            (high * maxHeight) / highHeight,
            fits,
          )
  }
  const bestFit = step < low ? minFontSize : step / FIT_STEPS_PER_PX

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
