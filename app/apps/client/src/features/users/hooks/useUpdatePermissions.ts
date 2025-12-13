import { useMutation, useQueryClient } from '@tanstack/react-query'

import { USERS_QUERY_KEY } from './useUsers'
import { updateUserPermissions } from '../service'
import type { Permission } from '../types'

export function useUpdatePermissions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      permissions,
    }: {
      id: number
      permissions: Permission[]
    }) => updateUserPermissions(id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}
