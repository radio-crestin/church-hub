import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getStreamKeys,
  getYouTubeConfig,
  updateYouTubeConfig,
} from '../service'
import type { YouTubeConfig } from '../types'

export function useYouTubeConfig() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'config'],
    queryFn: getYouTubeConfig,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (config: Partial<YouTubeConfig>) => updateYouTubeConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'youtube', 'config'],
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

export function useStreamKeys() {
  return useQuery({
    queryKey: ['livestream', 'youtube', 'streams'],
    queryFn: getStreamKeys,
    staleTime: 10 * 60 * 1000,
  })
}
