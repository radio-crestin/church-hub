import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertSongSlide } from '../service'
import type { UpsertSlideInput } from '../types'

export function useUpsertSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertSlideInput) => upsertSongSlide(input),
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['song', variables.songId] })
      }
    },
  })
}
