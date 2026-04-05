import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { createLogger } from '~/utils/logger'
import { useLivestreamWebSocket } from './useLivestreamWebSocket'
import { getActiveBroadcast, startStream, stopStream } from '../service'
import type { BroadcastInfo } from '../types'

const logger = createLogger('app:livestream')

export function useStreaming() {
  const queryClient = useQueryClient()
  const { streamStartProgress, clearStreamStartProgress, livestreamStatus } =
    useLivestreamWebSocket()

  const activeBroadcastQuery = useQuery({
    queryKey: ['livestream', 'broadcast', 'active'],
    queryFn: async () => {
      logger.debug('Fetching active broadcast')
      const broadcast = await getActiveBroadcast()
      logger.debug(
        `Active broadcast: ${broadcast ? `${broadcast.broadcastId} (${broadcast.status})` : 'none'}`,
      )
      return broadcast
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })

  const startMutation = useMutation({
    mutationFn: async () => {
      logger.info('Starting stream')
      const result = await startStream()
      logger.info('Stream started', result?.broadcast?.broadcastId)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'obs'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: async () => {
      logger.info('Stopping stream')
      const result = await stopStream()
      logger.info('Stream stopped')
      return result
    },
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
        url:
          livestreamStatus.broadcastUrl ||
          `https://youtu.be/${livestreamStatus.broadcastId}`,
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
