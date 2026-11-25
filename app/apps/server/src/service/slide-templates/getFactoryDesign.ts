import type { TemplateDesign, TemplateLayouts } from './types'
import { contentTypes } from '../../db/schema'
import { getDefaultContentConfig } from '../presentation/default-design/getDefaultContentConfig'
import { getDefaultGlobalSettings } from '../presentation/default-design/getDefaultGlobalSettings'
import { getDefaultNextSlideConfig } from '../presentation/default-design/getDefaultNextSlideConfig'
import type { ScreenType } from '../presentation/types'

const CANVAS: Record<ScreenType, { width: number; height: number }> = {
  primary: { width: 1920, height: 1080 },
  stage: { width: 1920, height: 1080 },
  // Lobby portrait display (screenLayouts' kiosk).
  kiosk: { width: 1080, height: 1920 },
  livestream: { width: 1080, height: 420 },
}

/** The factory design of a screen type, as a template's design. */
export function getFactoryDesign(screenType: ScreenType): TemplateDesign {
  const layouts = {} as TemplateLayouts
  for (const type of contentTypes) {
    layouts[type] = getDefaultContentConfig(type, screenType)
  }
  return {
    ...CANVAS[screenType],
    layouts,
    globalSettings: getDefaultGlobalSettings(screenType),
    // Described but off: whoever wants the strip turns it on.
    nextSlide: { ...getDefaultNextSlideConfig(), enabled: false },
  }
}
