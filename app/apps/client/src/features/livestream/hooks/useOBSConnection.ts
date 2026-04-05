import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { connectToOBS, disconnectFromOBS, getOBSStatus } from '../service'

const logger = createLogger('app:livestream:obs')

export function useOBSConnection() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'obs', 'status'],
    queryFn: async () => {
      logger.debug('Polling OBS status')
      const status = await getOBSStatus()
      logger.debug(
        `OBS status: connected=${status.connected}, streaming=${status.isStreaming}, recording=${status.isRecording}`,
      )
      return status
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      logger.info('Connecting to OBS')
      const result = await connectToOBS()
      logger.info('Connected to OBS')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'obs'] })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      logger.info('Disconnecting from OBS')
      const result = await disconnectFromOBS()
      logger.info('Disconnected from OBS')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'obs'] })
    },
  })

  return {
    ...query,
    status: query.data,
    isConnected: query.data?.connected ?? false,
    isStreaming: query.data?.isStreaming ?? false,
    isRecording: query.data?.isRecording ?? false,
    connect: connectMutation.mutate,
    connectAsync: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutate,
    disconnectAsync: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  }
}
