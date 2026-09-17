import type {
  ClockElementConfig,
  ClockOverride,
  TextStyle,
} from '../../../types'
import { getDefaultClockConfig } from '../../../utils/defaultConfigs'

/** Gap to the screen's top and right edges, as a share of the screen's size. */
const EDGE_MARGIN = 0.02

/**
 * Widest a digit or colon gets, in em, across the fonts a screen offers. The
 * box is sized for the whole time at this width so it never wraps onto a
 * second line, which the fit would answer by shrinking the clock.
 */
const CHARACTER_WIDTH = 0.6

const LINE_HEIGHT = 1.2

/** Room below the line so sub-pixel rounding in a small preview never shrinks it. */
const BOX_HEIGHT = 1.5

/**
 * How strongly the clock shows through while text is drawn over it. At a
 * third of its strength a 140px clock is still easy to read at a glance, yet
 * it stays well below the full-strength lyrics crossing it, so the operator
 * reads the words first.
 */
export const CLOCK_BEHIND_TEXT_OPACITY = 0.35

export interface ClockOverrideLayout {
  style: TextStyle
  showSeconds: boolean
  /** Box in screen pixels, anchored to the screen's top-right corner */
  bounds: { x: number; y: number; width: number; height: number }
  opacity: number
}

/**
 * Where and how a preview draws its override clock. It always sits in the
 * top-right corner rather than in the screen clock's box: that box is sized
 * for the screen's own font, so it would clip the larger clock, and where the
 * operators hid that clock nobody has placed it anywhere. It is always bold;
 * the colour, shadow and seconds still come from the screen's clock settings,
 * which were chosen against the background the preview shows.
 *
 * The clock is drawn behind the content's text, and fades while there is text
 * on screen so the words stay readable where they cross it.
 */
export function getClockOverrideLayout(
  override: ClockOverride,
  clockConfig: ClockElementConfig | undefined,
  screenWidth: number,
  screenHeight: number,
  showsText: boolean,
): ClockOverrideLayout {
  const clock = clockConfig ?? getDefaultClockConfig()
  const text = clock.showSeconds ? '88:88:88' : '88:88'

  const marginX = screenWidth * EDGE_MARGIN
  const marginY = screenHeight * EDGE_MARGIN
  // A screen too small for the clock gets the largest box it has room for,
  // and the fit brings the text down to that box.
  const width = Math.min(
    text.length * CHARACTER_WIDTH * override.fontSize,
    screenWidth - marginX * 2,
  )
  const height = Math.min(
    override.fontSize * BOX_HEIGHT,
    screenHeight - marginY * 2,
  )

  return {
    style: {
      ...clock.style,
      fontFamily: override.fontFamily,
      maxFontSize: override.fontSize,
      bold: true,
      // No floor: the renderer's default 12px would stop the clock shrinking
      // with a narrow preview, where it would no longer be to scale.
      minFontSize: 1,
      alignment: 'right',
      verticalAlignment: 'top',
      lineHeight: LINE_HEIGHT,
      compressLines: false,
    },
    showSeconds: clock.showSeconds,
    bounds: { x: screenWidth - marginX - width, y: marginY, width, height },
    opacity: showsText ? CLOCK_BEHIND_TEXT_OPACITY : 1,
  }
}
