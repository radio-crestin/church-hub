import { useMutation, useQueryClient } from '@tanstack/react-query'

import { screenQueryKey } from './useScreen'
import { updateScreenContentConfig } from '../service/screens'
import type { ContentType, ContentTypeConfig } from '../types'

interface UpdateContentConfigInput {
  screenId: number
  contentType: ContentType
  config: ContentTypeConfig
}

export function useUpdateScreenContentConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ screenId, contentType, config }: UpdateContentConfigInput) =>
      updateScreenContentConfig(screenId, contentType, config),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: screenQueryKey(variables.screenId),
      })
    },
  })
}
