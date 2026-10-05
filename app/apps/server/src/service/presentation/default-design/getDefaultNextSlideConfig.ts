import { boxPlacement, COLORS, FONTS, textStyle } from './designPrimitives'
import type { NextSlideSectionConfig } from '../types'

/**
 * The stage "next slide" strip: the bottom 22% of the screen, a gold label and
 * the upcoming words in a lighter grey, so they never compete with the current
 * slide. Screens get it switched off; whoever wants it turns it on.
 */
export function getDefaultNextSlideConfig(): NextSlideSectionConfig {
  return {
    enabled: true,
    ...boxPlacement({ top: 78, right: 0, bottom: 0, left: 0 }),
    labelText: 'Urmează:',
    labelStyle: textStyle({
      fontFamily: FONTS.title,
      maxFontSize: 24,
      autoScale: false,
      alignment: 'left',
      bold: true,
      color: COLORS.accent,
    }),
    contentStyle: textStyle({
      maxFontSize: 32,
      autoScale: true,
      alignment: 'left',
      bold: true,
      color: COLORS.muted,
    }),
    background: { type: 'color', color: '#141414', opacity: 0.9 },
  } as NextSlideSectionConfig
}
