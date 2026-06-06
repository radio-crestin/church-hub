import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertCategory } from '../service'
import type { UpsertCategoryInput } from '../types'

export function useUpsertCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertCategoryInput) => upsertCategory(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
        // Hiding/showing a category changes which songs are listed, so the song
        // browser must refetch too.
        queryClient.invalidateQueries({ queryKey: ['songs'] })
      }
    },
  })
}
