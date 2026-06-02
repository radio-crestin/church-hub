import { useMutation, useQueryClient } from '@tanstack/react-query'

import { LOCAL_USERS_QUERY_KEY } from './useLocalUsers'
import { USERS_QUERY_KEY } from './useUsers'
import { setUserPassword } from '../service'

export function useSetUserPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string | null }) =>
      setUserPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: LOCAL_USERS_QUERY_KEY })
    },
  })
}
