import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addToPlaylist,
  deletePlaylist,
  getPlaylistById,
  getPlaylists,
  removeFromPlaylist,
  reorderPlaylistItems,
  upsertPlaylist,
} from '../service'
import type { MusicPlaylist, MusicPlaylistWithItems } from '../types'

export function usePlaylists() {
  return useQuery<MusicPlaylist[]>({
    queryKey: ['music', 'playlists'],
    queryFn: getPlaylists,
  })
}

export function usePlaylist(id: number | null) {
  return useQuery<MusicPlaylistWithItems | null>({
    queryKey: ['music', 'playlist', id],
    queryFn: () => (id ? getPlaylistById(id) : null),
    enabled: id !== null,
  })
}

export function useUpsertPlaylist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id?: number; name: string; description?: string }) =>
      upsertPlaylist(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music', 'playlists'] })
    },
  })
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music', 'playlists'] })
    },
  })
}

export function useAddToPlaylist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playlistId,
      fileId,
    }: {
      playlistId: number
      fileId: number
    }) => addToPlaylist(playlistId, fileId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['music', 'playlist', variables.playlistId],
      })
      queryClient.invalidateQueries({ queryKey: ['music', 'playlists'] })
    },
  })
}

export function useRemoveFromPlaylist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playlistId,
      itemId,
    }: {
      playlistId: number
      itemId: number
    }) => removeFromPlaylist(playlistId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['music', 'playlist', variables.playlistId],
      })
      queryClient.invalidateQueries({ queryKey: ['music', 'playlists'] })
    },
  })
}

export function useReorderPlaylistItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      playlistId,
      itemIds,
    }: {
      playlistId: number
      itemIds: number[]
    }) => reorderPlaylistItems(playlistId, itemIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['music', 'playlist', variables.playlistId],
      })
    },
  })
}
