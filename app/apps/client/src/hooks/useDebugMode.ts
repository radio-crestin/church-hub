import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getDebugMode, saveDebugMode } from '~/service/debug'

const DEBUG_MODE_QUERY_KEY = ['settings', 'debug_mode']

/**
 * Hook to get and set the debug mode setting
 */
export function useDebugMode() {
  const queryClient = useQueryClient()

  const { data: isDebugMode = false, isLoading } = useQuery({
    queryKey: DEBUG_MODE_QUERY_KEY,
    queryFn: getDebugMode,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const { mutateAsync: setDebugMode, isPending: isSaving } = useMutation({
    mutationFn: saveDebugMode,
    onSuccess: (_result, enabled) => {
      queryClient.setQueryData(DEBUG_MODE_QUERY_KEY, enabled)
    },
  })

  return {
    isDebugMode,
    setDebugMode,
    isLoading,
    isSaving,
  }
}
