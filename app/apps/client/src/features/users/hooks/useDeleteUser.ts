import { useMutation, useQueryClient } from '@tanstack/react-query'

import { USERS_QUERY_KEY } from './useUsers'
import { deleteUser } from '../service'

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}
