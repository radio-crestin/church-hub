import { useMutation, useQueryClient } from '@tanstack/react-query'

import { clearQueue } from '../service'
import type { QueueItem } from '../types'

export function useClearQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => clearQueue(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['queue'] })
      const previousQueue = queryClient.getQueryData<QueueItem[]>(['queue'])
      queryClient.setQueryData(['queue'], [])
      return { previousQueue }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueue) {
        queryClient.setQueryData(['queue'], context.previousQueue)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}
