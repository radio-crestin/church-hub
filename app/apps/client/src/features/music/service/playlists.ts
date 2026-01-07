import { fetcher } from '~/utils/fetcher'
import type { MusicPlaylist, MusicPlaylistWithItems } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getPlaylists(): Promise<MusicPlaylist[]> {
  const response = await fetcher<ApiResponse<MusicPlaylist[]>>(
    '/api/music/playlists',
  )
  return response.data ?? []
}

export async function getPlaylistById(
  id: number,
): Promise<MusicPlaylistWithItems | null> {
  const response = await fetcher<ApiResponse<MusicPlaylistWithItems>>(
    `/api/music/playlists/${id}`,
  )
  return response.data ?? null
}

export async function upsertPlaylist(input: {
  id?: number
  name: string
  description?: string | null
}): Promise<MusicPlaylist | null> {
  const response = await fetcher<ApiResponse<MusicPlaylist>>(
    '/api/music/playlists',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return response.data ?? null
}

export async function deletePlaylist(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/music/playlists/${id}`,
    { method: 'DELETE' },
  )
  return response.data?.success ?? false
}

export async function addToPlaylist(
  playlistId: number,
  fileId: number,
): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/music/playlists/${playlistId}/items`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    },
  )
  return response.data?.success ?? false
}

export async function removeFromPlaylist(
  playlistId: number,
  itemId: number,
): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/music/playlists/${playlistId}/items/${itemId}`,
    { method: 'DELETE' },
  )
  return response.data?.success ?? false
}

export async function reorderPlaylistItems(
  playlistId: number,
  itemIds: number[],
): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/music/playlists/${playlistId}/items/reorder`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds }),
    },
  )
  return response.data?.success ?? false
}
