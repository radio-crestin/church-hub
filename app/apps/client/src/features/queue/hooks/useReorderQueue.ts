import { useMutation, useQueryClient } from '@tanstack/react-query'

import { reorderQueue } from '../service'
import type { QueueItem, ReorderQueueInput } from '../types'

export function useReorderQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ReorderQueueInput) => reorderQueue(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['queue'] })
      const previousQueue = queryClient.getQueryData<QueueItem[]>(['queue'])

      // Optimistically reorder
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) => {
        if (!old) return []

        const itemMap = new Map(old.map((item) => [item.id, item]))
        return input.itemIds
          .map((id) => itemMap.get(id))
          .filter((item): item is QueueItem => item !== undefined)
          .map((item, index) => ({ ...item, sortOrder: index }))
      })

      return { previousQueue }
    },
    onError: (_err, _input, context) => {
      if (context?.previousQueue) {
        queryClient.setQueryData(['queue'], context.previousQueue)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}
