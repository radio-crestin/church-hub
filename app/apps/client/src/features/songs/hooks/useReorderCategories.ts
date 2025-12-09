import { useMutation, useQueryClient } from '@tanstack/react-query'

import { reorderCategories } from '../service'

export function useReorderCategories() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (categoryIds: number[]) => reorderCategories(categoryIds),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
      }
    },
  })
}
