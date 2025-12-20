import { useMutation } from '@tanstack/react-query'

import { updateScreenContentConfig } from '../service/screens'
import type { ContentType, ContentTypeConfig } from '../types'

interface UpdateContentConfigInput {
  screenId: number
  contentType: ContentType
  config: ContentTypeConfig
}

export function useUpdateScreenContentConfig() {
  return useMutation({
    mutationFn: ({ screenId, contentType, config }: UpdateContentConfigInput) =>
      updateScreenContentConfig(screenId, contentType, config),
    // Note: Query invalidation is handled by WebSocket broadcast from server
  })
}
