import type { SlideStyleOverride } from '~/features/songs/types'
import type { TextStyle } from '../types'

/**
 * Merges a slide's own styling over the screen's default text style.
 *
 * The screen settings stay the baseline for every slide; an override only
 * states where this one slide departs from them, so an absent key keeps the
 * screen value and clearing the override restores the default everywhere at
 * once. Font size is a multiplier rather than an absolute size so a slide the
 * operator enlarged still scales with the screen's own font settings.
 */
export function applySlideStyleOverride(
  style: TextStyle,
  override?: SlideStyleOverride | null,
): TextStyle {
  if (!override) return style

  const scale = override.fontScale ?? 1

  return {
    ...style,
    maxFontSize: style.maxFontSize * scale,
    minFontSize:
      style.minFontSize === undefined ? undefined : style.minFontSize * scale,
    alignment: override.alignment ?? style.alignment,
    bold: override.bold ?? style.bold,
    italic: override.italic ?? style.italic,
    underline: override.underline ?? style.underline,
  }
}
