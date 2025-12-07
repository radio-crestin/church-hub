import { useMutation, useQueryClient } from '@tanstack/react-query'

import { removeFromQueue } from '../service'
import type { QueueItem } from '../types'

export function useRemoveFromQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => removeFromQueue(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['queue'] })

      // Snapshot previous value
      const previousQueue = queryClient.getQueryData<QueueItem[]>(['queue'])

      // Optimistically update
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) => {
        if (!old) return []
        return old.filter((item) => item.id !== id)
      })

      return { previousQueue }
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousQueue) {
        queryClient.setQueryData(['queue'], context.previousQueue)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}
