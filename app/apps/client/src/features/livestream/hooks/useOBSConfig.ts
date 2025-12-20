import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getOBSConfig, updateOBSConfig } from '../service'
import type { OBSConfig } from '../types'

export function useOBSConfig() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'obs', 'config'],
    queryFn: getOBSConfig,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (config: Partial<OBSConfig>) => updateOBSConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'obs', 'config'],
      })
    },
  })

  return {
    ...query,
    config: query.data,
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  }
}
