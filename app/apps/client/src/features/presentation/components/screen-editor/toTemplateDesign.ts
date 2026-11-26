import type { TemplateDesign } from '~/features/slide-templates/utils/applyTemplatePreview'
import type { ScreenWithConfigs } from '../../types'

/** The template's design as the editor holds it, on a screen. */
export function toTemplateDesign(screen: ScreenWithConfigs): TemplateDesign {
  return {
    width: screen.width,
    height: screen.height,
    layouts: screen.contentConfigs,
    globalSettings: screen.globalSettings,
    nextSlide: screen.nextSlideConfig,
  }
}
