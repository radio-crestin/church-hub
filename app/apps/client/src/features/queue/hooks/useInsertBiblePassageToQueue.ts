import { useMutation, useQueryClient } from '@tanstack/react-query'

import { insertBiblePassageToQueue } from '../service'
import type { InsertBiblePassageInput } from '../types'

export function useInsertBiblePassageToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: InsertBiblePassageInput) =>
      insertBiblePassageToQueue(input),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate to refetch the queue with the new item in correct position
        queryClient.invalidateQueries({ queryKey: ['queue'] })
      }
    },
  })
}
