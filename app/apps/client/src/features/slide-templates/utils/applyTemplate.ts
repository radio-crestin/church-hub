import type { ScreenWithConfigs } from '~/features/presentation/types'
import type { SlideTemplate } from '../types'

export type TemplateDesignWithId = Pick<
  SlideTemplate,
  'id' | 'width' | 'height' | 'layouts' | 'globalSettings' | 'nextSlide'
>

/**
 * The screen drawing with another template: its canvas, layouts, clock and
 * next-slide strip; the screen's own window settings stay.
 */
export function applyTemplate(
  screen: ScreenWithConfigs,
  template: TemplateDesignWithId,
): ScreenWithConfigs {
  return {
    ...screen,
    templateId: template.id,
    width: template.width,
    height: template.height,
    globalSettings: template.globalSettings,
    contentConfigs: template.layouts,
    nextSlideConfig: template.nextSlide,
  }
}
