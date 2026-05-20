import { useMutation, useQueryClient } from '@tanstack/react-query'

import { reorderTags } from '../service'

export function useReorderTags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (tagIds: number[]) => reorderTags(tagIds),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['song-tags'] })
      }
    },
  })
}
