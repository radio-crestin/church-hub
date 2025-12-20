import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { connectToOBS, disconnectFromOBS, getOBSStatus } from '../service'

export function useOBSConnection() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'obs', 'status'],
    queryFn: getOBSStatus,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  })

  const connectMutation = useMutation({
    mutationFn: connectToOBS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'obs'] })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectFromOBS,
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
