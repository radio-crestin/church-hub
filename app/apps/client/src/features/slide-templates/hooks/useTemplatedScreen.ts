import { useMemo } from 'react'

import type { ScreenWithConfigs } from '~/features/presentation/types'
import { useSlideTemplate } from './useSlideTemplates'
import { applyTemplate } from '../utils/applyTemplate'

/**
 * The template a screen draws the current slide with: the presentation's (or
 * its item's) on a screen that follows presentations, else the live OBS
 * scene's, else the screen's own. Until another template has loaded, the
 * screen's own stands in.
 */
export function resolveTemplateId(
  screen: ScreenWithConfigs | null | undefined,
  obsSceneName: string | null | undefined,
  presentationTemplateId: number | null | undefined,
): number | null {
  if (!screen) return null
  if (screen.followsPresentation && presentationTemplateId) {
    return presentationTemplateId
  }
  return (obsSceneName && screen.sceneTemplates?.[obsSceneName]) || null
}

export function useTemplatedScreen(
  screen: ScreenWithConfigs | null | undefined,
  obsSceneName: string | null | undefined,
  presentationTemplateId: number | null | undefined,
): ScreenWithConfigs | null | undefined {
  const resolved = resolveTemplateId(
    screen,
    obsSceneName,
    presentationTemplateId,
  )
  const otherId = resolved !== screen?.templateId ? resolved : null
  const { data: template } = useSlideTemplate(otherId)
  return useMemo(
    () =>
      screen && otherId && template?.id === otherId
        ? applyTemplate(screen, template)
        : screen,
    [screen, otherId, template],
  )
}
