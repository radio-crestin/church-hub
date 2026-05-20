import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteTag } from '../service'

export function useDeleteTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTag,
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['song-tags'] })
        queryClient.invalidateQueries({ queryKey: ['songs'] })
      }
    },
  })
}
