import type { SlideStyleOverride } from '~/features/songs/types'
import type { TextStyle } from '../types'

/**
 * Merges a slide's own styling over the screen's default text style.
 *
 * The screen settings stay the baseline for every slide; an override only
 * states where this one slide departs from them, so an absent key keeps the
 * screen value and clearing the override restores the default everywhere at
 * once.
 *
 * Font size is deliberately NOT handled here. The renderers auto-fit the text
 * to the element, so raising the ceiling does nothing for a slide that is
 * already limited by its height — the operator would press "bigger" and see no
 * change. The slide's scale is applied to the fitted size instead, by the
 * renderer; see `resolveSlideFontScale`.
 */
export function applySlideStyleOverride(
  style: TextStyle,
  override?: SlideStyleOverride | null,
): TextStyle {
  if (!override) return style

  return {
    ...style,
    alignment: override.alignment ?? style.alignment,
    bold: override.bold ?? style.bold,
    italic: override.italic ?? style.italic,
    underline: override.underline ?? style.underline,
  }
}

/** Multiplier the renderer applies to the fitted font size. 1 = screen default. */
export function resolveSlideFontScale(
  override?: SlideStyleOverride | null,
): number {
  return override?.fontScale ?? 1
}
