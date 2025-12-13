import { useMutation, useQueryClient } from '@tanstack/react-query'

import { USERS_QUERY_KEY } from './useUsers'
import { regenerateUserToken } from '../service'

export function useRegenerateToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => regenerateUserToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}
