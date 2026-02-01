import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useLivestreamWebSocket } from './useLivestreamWebSocket'
import { getActiveBroadcast, startStream, stopStream } from '../service'
import type { BroadcastInfo } from '../types'

export function useStreaming() {
  const queryClient = useQueryClient()
  const { streamStartProgress, clearStreamStartProgress, livestreamStatus } =
    useLivestreamWebSocket()

  const activeBroadcastQuery = useQuery({
    queryKey: ['livestream', 'broadcast', 'active'],
    queryFn: getActiveBroadcast,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })

  const startMutation = useMutation({
    mutationFn: startStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'obs'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: stopStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream'] })
    },
  })

  // Use WebSocket livestream status if available, otherwise fall back to query
  const isLive =
    livestreamStatus !== null
      ? livestreamStatus.isLive
      : activeBroadcastQuery.data?.status === 'live'

  // The broadcast info to display. Prefer the websocket livestreamStatus
  // (sent directly by the server with the correct broadcast data) over the
  // YouTube API query which can return stale/wrong broadcasts.
  const activeBroadcast = useMemo((): BroadcastInfo | null | undefined => {
    if (livestreamStatus?.isLive && livestreamStatus.broadcastId) {
      return {
        broadcastId: livestreamStatus.broadcastId,
        title: livestreamStatus.title || '',
        url: livestreamStatus.broadcastUrl || `https://youtu.be/${livestreamStatus.broadcastId}`,
        status: 'live',
        scheduledStartTime: new Date(livestreamStatus.startedAt || Date.now()),
        actualStartTime: new Date(livestreamStatus.startedAt || Date.now()),
      }
    }
    return activeBroadcastQuery.data
  }, [livestreamStatus, activeBroadcastQuery.data])

  return {
    activeBroadcast,
    isLoadingBroadcast: activeBroadcastQuery.isLoading,
    isLive,
    start: startMutation.mutate,
    startAsync: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    stop: stopMutation.mutate,
    stopAsync: stopMutation.mutateAsync,
    isStopping: stopMutation.isPending,
    lastStartedBroadcast: startMutation.data?.broadcast,
    streamStartProgress,
    clearStreamStartProgress,
  }
}
