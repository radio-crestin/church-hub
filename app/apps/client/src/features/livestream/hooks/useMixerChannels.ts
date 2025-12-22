import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getMixerChannels, updateMixerChannels } from '../service/mixer'
import type { MixerChannel } from '../types'

export function useMixerChannels() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'mixer', 'channels'],
    queryFn: getMixerChannels,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (channels: { channelNumber: number; label: string }[]) =>
      updateMixerChannels(channels),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['livestream', 'mixer', 'channels'],
      })
    },
  })

  return {
    ...query,
    channels: query.data ?? [],
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  }
}

export function useMixerChannelsMap() {
  const { channels } = useMixerChannels()

  const channelMap = new Map<number, MixerChannel>()
  for (const channel of channels) {
    channelMap.set(channel.channelNumber, channel)
  }

  return channelMap
}
