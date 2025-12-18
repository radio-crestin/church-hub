import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getSidebarConfiguration,
  saveSidebarConfiguration,
} from '../service/sidebarConfig'
import type { SidebarConfiguration } from '../types'

export const SIDEBAR_CONFIG_QUERY_KEY = ['settings', 'sidebar_configuration']

/**
 * Hook for fetching and updating sidebar configuration
 */
export function useSidebarConfig() {
  const queryClient = useQueryClient()

  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: SIDEBAR_CONFIG_QUERY_KEY,
    queryFn: getSidebarConfiguration,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const updateConfig = useMutation({
    mutationFn: saveSidebarConfiguration,
    onMutate: async (newConfig: SidebarConfiguration) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: SIDEBAR_CONFIG_QUERY_KEY })

      // Snapshot the previous value
      const previousConfig = queryClient.getQueryData<SidebarConfiguration>(
        SIDEBAR_CONFIG_QUERY_KEY,
      )

      // Optimistically update
      queryClient.setQueryData(SIDEBAR_CONFIG_QUERY_KEY, newConfig)

      return { previousConfig }
    },
    onError: (_err, _newConfig, context) => {
      // Rollback on error
      if (context?.previousConfig) {
        queryClient.setQueryData(
          SIDEBAR_CONFIG_QUERY_KEY,
          context.previousConfig,
        )
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: SIDEBAR_CONFIG_QUERY_KEY })
    },
  })

  return {
    config,
    isLoading,
    error,
    updateConfig,
  }
}
