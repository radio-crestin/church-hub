import { useMutation } from '@tanstack/react-query'

import { batchUpdateScreenConfig } from '../service/screens'
import type {
  NextSlideSectionConfig,
  ScreenGlobalSettings,
  ScreenWithConfigs,
} from '../types'

interface BatchUpdateInput {
  screenId: number
  globalSettings: ScreenGlobalSettings
  contentConfigs: ScreenWithConfigs['contentConfigs']
  nextSlideConfig?: NextSlideSectionConfig
  width?: number
  height?: number
}

export function useBatchUpdateScreenConfig() {
  return useMutation({
    mutationFn: ({
      screenId,
      globalSettings,
      contentConfigs,
      nextSlideConfig,
      width,
      height,
    }: BatchUpdateInput) =>
      batchUpdateScreenConfig(
        screenId,
        globalSettings,
        contentConfigs,
        nextSlideConfig,
        width,
        height,
      ),
    // Note: Query invalidation is handled by WebSocket broadcast from server
  })
}
