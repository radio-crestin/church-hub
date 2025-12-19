import { useMutation, useQueryClient } from '@tanstack/react-query'

import { screenQueryKey } from './useScreen'
import { updateScreenNextSlideConfig } from '../service/screens'
import type { NextSlideSectionConfig } from '../types'

interface UpdateNextSlideConfigInput {
  screenId: number
  config: NextSlideSectionConfig
}

export function useUpdateScreenNextSlideConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ screenId, config }: UpdateNextSlideConfigInput) =>
      updateScreenNextSlideConfig(screenId, config),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: screenQueryKey(variables.screenId),
      })
    },
  })
}
