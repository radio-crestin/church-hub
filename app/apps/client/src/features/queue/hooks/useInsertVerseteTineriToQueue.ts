import { useMutation, useQueryClient } from '@tanstack/react-query'

import { insertVerseteTineriToQueue } from '../service'
import type { InsertVerseteTineriInput } from '../types'

export function useInsertVerseteTineriToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: InsertVerseteTineriInput) =>
      insertVerseteTineriToQueue(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['queue'] })
      }
    },
  })
}
