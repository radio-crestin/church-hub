import type { QueryClient } from '@tanstack/react-query'

import { screensQueryKey } from '~/features/presentation/hooks/useScreens'
import type { ScreenWithConfigs } from '~/features/presentation/types'
import { reloadQueries } from '~/features/presentation/utils/reloadQueries'
import { applyTemplate } from './applyTemplate'
import {
  slideTemplateQueryKey,
  slideTemplatesQueryKey,
} from '../hooks/useSlideTemplates'
import type { SlideTemplate } from '../types'

export type TemplateDesign = Pick<
  SlideTemplate,
  'width' | 'height' | 'layouts' | 'globalSettings' | 'nextSlide'
>

/**
 * Another window is editing a template: every screen drawing with it here
 * shows the unsaved design. `null` (editing ended) loads the saved one again.
 */
export function applyTemplatePreview(
  queryClient: QueryClient,
  templateId: number,
  design: TemplateDesign | null,
): void {
  if (!design) {
    reloadQueries(queryClient, slideTemplatesQueryKey)
    reloadQueries(queryClient, screensQueryKey)
    return
  }
  queryClient.setQueryData<SlideTemplate>(
    slideTemplateQueryKey(templateId),
    (template) => template && { ...template, ...design },
  )
  for (const [key, screen] of queryClient.getQueriesData<ScreenWithConfigs>({
    queryKey: screensQueryKey,
  })) {
    // The list holds plain screens; each screen's own query has its layouts.
    if (!screen || Array.isArray(screen) || screen.templateId !== templateId) {
      continue
    }
    queryClient.setQueryData(
      key,
      applyTemplate(screen, { id: templateId, ...design }),
    )
  }
}
