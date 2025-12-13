import { useMutation, useQueryClient } from '@tanstack/react-query'

import { USERS_QUERY_KEY } from './useUsers'
import { updateUser } from '../service'
import type { UpdateUserInput } from '../types'

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
      updateUser(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}
