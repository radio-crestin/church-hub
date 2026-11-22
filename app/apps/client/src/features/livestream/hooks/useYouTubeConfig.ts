import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getPastBroadcasts,
  getStreamKeys,
  getUpcomingBroadcasts,
  getVideoCategories,
  getYouTubeConfig,
  getYoutubePlaylists,
  updateYouTubeConfig,
  type YouTubeConfigUpdate,
} from '../service'

export function useYouTubeConfig() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'config'],
    queryFn: getYouTubeConfig,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (config: YouTubeConfigUpdate) => updateYouTubeConfig(config),
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

export function useUpcomingBroadcasts() {
  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'broadcasts', 'upcoming'],
    queryFn: getUpcomingBroadcasts,
    staleTime: 60 * 1000,
  })

  return {
    broadcasts: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    error: query.error,
  }
}

export function usePastBroadcasts(enabled = true) {
  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'broadcasts', 'completed'],
    queryFn: getPastBroadcasts,
    staleTime: 60 * 1000,
    enabled,
  })

  return {
    broadcasts: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    error: query.error,
  }
}

export function useYoutubePlaylists(enabled = true) {
  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'playlists'],
    queryFn: getYoutubePlaylists,
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  return {
    playlists: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    error: query.error,
  }
}

/** The categories a broadcast's video can be given, named in `language`. */
export function useVideoCategories(language: string, enabled = true) {
  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'categories', language],
    queryFn: () => getVideoCategories(language),
    staleTime: 60 * 60 * 1000,
    enabled,
  })
  return { categories: query.data ?? [], isLoading: query.isLoading }
}
