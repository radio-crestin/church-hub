import type { TextStyle } from '../../../types'

/** The floor the auto-fit falls back to when a style sets none (AnimatedText). */
const DEFAULT_MIN_FONT_SIZE = 12

/**
 * A screen's text style for drawing that screen at `fontScale` times its own
 * size. Both ends of the auto-fit range are screen pixels, so both scale: a
 * floor left unscaled stops a small preview from shrinking the text as far as
 * the projection does, and the words spill out of their box in the preview
 * while they fit on the screen.
 */
export function scaleTextStyle<T extends TextStyle>(
  style: T,
  fontScale: number,
): T {
  return {
    ...style,
    maxFontSize: style.maxFontSize * fontScale,
    minFontSize: (style.minFontSize ?? DEFAULT_MIN_FONT_SIZE) * fontScale,
  }
}
