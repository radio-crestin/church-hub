import { useMutation, useQueryClient } from '@tanstack/react-query'

import { addToQueue } from '../service'
import type { AddToQueueInput, QueueItem } from '../types'

export function useAddToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddToQueueInput) => addToQueue(input),
    onSuccess: (result) => {
      if (result.success && result.data) {
        // Optimistically update the queue
        queryClient.setQueryData<QueueItem[]>(['queue'], (old) => {
          if (!old) return [result.data!]
          return [...old, result.data!]
        })
      }
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}
