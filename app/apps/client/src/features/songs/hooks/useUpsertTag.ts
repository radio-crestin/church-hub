import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertTag } from '../service'
import type { UpsertTagInput } from '../types'

export function useUpsertTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertTagInput) => upsertTag(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['song-tags'] })
      }
    },
  })
}
