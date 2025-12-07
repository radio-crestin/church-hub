import { useMutation, useQueryClient } from '@tanstack/react-query'

import { insertSlideToQueue } from '../service'
import type { InsertSlideInput } from '../types'

export function useInsertSlideToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: InsertSlideInput) => insertSlideToQueue(input),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate to refetch the queue with the new item in correct position
        queryClient.invalidateQueries({ queryKey: ['queue'] })
      }
    },
  })
}
