import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteCategory } from '../service'

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
      }
    },
  })
}
