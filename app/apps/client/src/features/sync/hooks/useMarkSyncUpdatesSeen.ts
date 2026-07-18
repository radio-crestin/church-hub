import { useMutation, useQueryClient } from '@tanstack/react-query'

import { markSyncUpdatesSeen } from '../service'

/** Marks update entries seen (no ids = all) and refreshes badges/counters. */
export function useMarkSyncUpdatesSeen() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids?: number[]) => markSyncUpdatesSeen(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync', 'updates'] })
      queryClient.invalidateQueries({ queryKey: ['sync', 'status'] })
    },
  })
}
