import { useMutation } from '@tanstack/react-query'

import { updateScreenNextSlideConfig } from '../service/screens'
import type { NextSlideSectionConfig } from '../types'

interface UpdateNextSlideConfigInput {
  screenId: number
  config: NextSlideSectionConfig
}

export function useUpdateScreenNextSlideConfig() {
  return useMutation({
    mutationFn: ({ screenId, config }: UpdateNextSlideConfigInput) =>
      updateScreenNextSlideConfig(screenId, config),
    // Note: Query invalidation is handled by WebSocket broadcast from server
  })
}
