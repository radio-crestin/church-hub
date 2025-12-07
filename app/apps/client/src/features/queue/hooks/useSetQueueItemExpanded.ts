import { useMutation, useQueryClient } from '@tanstack/react-query'

import { setQueueItemExpanded } from '../service'
import type { QueueItem } from '../types'

interface SetExpandedInput {
  id: number
  expanded: boolean
}

export function useSetQueueItemExpanded() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, expanded }: SetExpandedInput) =>
      setQueueItemExpanded(id, expanded),
    onMutate: async ({ id, expanded }) => {
      await queryClient.cancelQueries({ queryKey: ['queue'] })
      const previousQueue = queryClient.getQueryData<QueueItem[]>(['queue'])

      // Optimistically update
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) => {
        if (!old) return []
        return old.map((item) =>
          item.id === id ? { ...item, isExpanded: expanded } : item,
        )
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
