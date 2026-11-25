import type { ScreenWithConfigs } from '~/features/presentation/types'
import type { SlideTemplate } from '../types'

/**
 * A template drawn on its own, as the screen the renderer expects (a
 * projector with no window settings): for thumbnails and the template editor.
 */
export function templateAsScreen(template: SlideTemplate): ScreenWithConfigs {
  return {
    id: 0,
    name: template.name,
    type: 'primary',
    isActive: false,
    openMode: 'browser',
    isFullscreen: false,
    alwaysOnTop: false,
    closeOnEscape: false,
    isPreviewScreen: false,
    openOnStartup: false,
    monitorName: null,
    templateId: template.id,
    followsPresentation: false,
    sceneTemplates: {},
    width: template.width,
    height: template.height,
    globalSettings: template.globalSettings,
    contentConfigs: template.layouts,
    nextSlideConfig: template.nextSlide,
    sortOrder: 0,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}
