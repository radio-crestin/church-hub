import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useLivestreamWebSocket } from './useLivestreamWebSocket'
import { getActiveBroadcast, startStream, stopStream } from '../service'

export function useStreaming() {
  const queryClient = useQueryClient()
  const { streamStartProgress } = useLivestreamWebSocket()

  const activeBroadcastQuery = useQuery({
    queryKey: ['livestream', 'broadcast', 'active'],
    queryFn: getActiveBroadcast,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })

  const startMutation = useMutation({
    mutationFn: startStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: stopStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream'] })
    },
  })

  return {
    activeBroadcast: activeBroadcastQuery.data,
    isLoadingBroadcast: activeBroadcastQuery.isLoading,
    isLive: activeBroadcastQuery.data?.status === 'live',
    start: startMutation.mutate,
    startAsync: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    stop: stopMutation.mutate,
    stopAsync: stopMutation.mutateAsync,
    isStopping: stopMutation.isPending,
    lastStartedBroadcast: startMutation.data?.broadcast,
    streamStartProgress,
  }
}
