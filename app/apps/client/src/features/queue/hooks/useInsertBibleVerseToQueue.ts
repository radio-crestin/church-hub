import { useMutation, useQueryClient } from '@tanstack/react-query'

import { insertBibleVerseToQueue } from '../service'
import type { InsertBibleVerseInput } from '../types'

export function useInsertBibleVerseToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: InsertBibleVerseInput) =>
      insertBibleVerseToQueue(input),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate to refetch the queue with the new item in correct position
        queryClient.invalidateQueries({ queryKey: ['queue'] })
      }
    },
  })
}
