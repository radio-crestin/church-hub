import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteSynonymGroup } from '~/service/synonyms'

export function useDeleteSynonym() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSynonymGroup,
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['synonyms'] })
      }
    },
  })
}
