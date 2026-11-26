import { useMemo } from 'react'

import { usePreviewScreen } from '~/features/presentation/hooks/usePreviewScreen'
import type { AnnouncementContentConfig } from '~/features/presentation/types'
import { useSchedule } from '~/features/schedules/hooks/useSchedule'
import { useSlideTemplate } from '~/features/slide-templates/hooks/useSlideTemplates'
import type { DeckTextStyle } from '../types'
import { titleStyleFromLayout } from '../utils/titleStyleFromLayout'

/**
 * The title style a presentation's new slides take: its theme's announcement
 * text, else the preview screen's.
 */
export function useDeckTitleStyle(scheduleId: number): DeckTextStyle {
  const { data: schedule } = useSchedule(scheduleId)
  const { data: template } = useSlideTemplate(schedule?.templateId)
  const { screen } = usePreviewScreen()
  return useMemo(
    () =>
      template
        ? titleStyleFromLayout(
            template.layouts.announcement as AnnouncementContentConfig,
            template.width,
          )
        : titleStyleFromLayout(
            screen?.contentConfigs.announcement as
              | AnnouncementContentConfig
              | undefined,
            screen?.width ?? 1920,
          ),
    [template, screen],
  )
}
