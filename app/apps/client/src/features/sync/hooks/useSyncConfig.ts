import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSyncConfig, updateSyncConfig } from '../service'

export const syncConfigQueryKey = ['sync', 'config'] as const

export function useSyncConfig() {
  const queryClient = useQueryClient()

  const configQuery = useQuery({
    queryKey: syncConfigQueryKey,
    queryFn: getSyncConfig,
    staleTime: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: updateSyncConfig,
    onSuccess: (config) => {
      queryClient.setQueryData(syncConfigQueryKey, config)
      // Enabling sync kicks a background cycle server-side, so refresh status.
      queryClient.invalidateQueries({ queryKey: ['sync', 'status'] })
    },
  })

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
