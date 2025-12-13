import { useMutation, useQueryClient } from '@tanstack/react-query'

import { USERS_QUERY_KEY } from './useUsers'
import { createUser } from '../service'
import type { CreateUserInput } from '../types'

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}
