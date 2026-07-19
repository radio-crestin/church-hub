import { useMutation, useQueryClient } from '@tanstack/react-query'

import { syncNow } from '../service'

export function useSyncNow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: syncNow,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sync'] })
      // When remote changes were applied, open library views must refresh.
      if (result.applied) {
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        queryClient.invalidateQueries({ queryKey: ['song'] })
        queryClient.invalidateQueries({ queryKey: ['schedules'] })
        queryClient.invalidateQueries({ queryKey: ['schedule'] })
      }
    },
  })
}
