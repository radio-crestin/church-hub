import { boxPlacement, COLORS, FONTS, textStyle } from './designPrimitives'
import { SCREEN_LAYOUTS } from './screenLayouts'
import type { ScreenGlobalSettings, ScreenType } from '../types'

/** Screen-wide defaults: the fallback background and the clock's place and look. */
export function getDefaultGlobalSettings(
  screenType: ScreenType = 'primary',
): ScreenGlobalSettings {
  const layout = SCREEN_LAYOUTS[screenType] ?? SCREEN_LAYOUTS.primary
  const { clock } = layout
  return {
    defaultBackground: layout.transparent
      ? { type: 'transparent', opacity: 1 }
      : { type: 'color', color: COLORS.background, opacity: 1 },
    clockConfig: {
      // Whether it shows is decided per content type (clockEnabled).
      enabled: false,
      ...boxPlacement(clock.box),
      style: textStyle({
        fontFamily: FONTS.title,
        maxFontSize: clock.maxFontSize,
        autoScale: true,
        bold: true,
        alignment: clock.alignment,
        shadow: layout.shadow,
      }),
      format: '24h',
      showSeconds: false,
    },
  } as ScreenGlobalSettings
}
