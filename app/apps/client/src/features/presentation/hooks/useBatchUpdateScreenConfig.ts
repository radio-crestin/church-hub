import { useMutation } from '@tanstack/react-query'

import { batchUpdateScreenConfig } from '../service/screens'
import type {
  ContentType,
  ContentTypeConfig,
  NextSlideSectionConfig,
  ScreenGlobalSettings,
} from '../types'

interface BatchUpdateInput {
  screenId: number
  globalSettings: ScreenGlobalSettings
  contentConfigs: Record<ContentType, ContentTypeConfig>
  nextSlideConfig?: NextSlideSectionConfig
}

export function useBatchUpdateScreenConfig() {
  return useMutation({
    mutationFn: ({
      screenId,
      globalSettings,
      contentConfigs,
      nextSlideConfig,
    }: BatchUpdateInput) =>
      batchUpdateScreenConfig(
        screenId,
        globalSettings,
        contentConfigs,
        nextSlideConfig,
      ),
    // Note: Query invalidation is handled by WebSocket broadcast from server
  })
}
