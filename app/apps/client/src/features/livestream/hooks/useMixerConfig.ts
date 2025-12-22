import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getMixerConfig,
  testMixerConnection,
  updateMixerConfig,
} from '../service/mixer'
import type { MixerConfig } from '../types'

export function useMixerConfig() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'mixer', 'config'],
    queryFn: getMixerConfig,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (config: Partial<MixerConfig>) => updateMixerConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'mixer', 'config'],
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: testMixerConnection,
  })

  return {
    ...query,
    config: query.data,
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    testConnection: testMutation.mutateAsync,
    isTesting: testMutation.isPending,
    testResult: testMutation.data,
  }
}
