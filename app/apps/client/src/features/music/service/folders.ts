import { fetcher } from '~/utils/fetcher'
import type { MusicFolder, SyncResult } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getFolders(): Promise<MusicFolder[]> {
  const response =
    await fetcher<ApiResponse<MusicFolder[]>>('/api/music/folders')
  return response.data ?? []
}

export async function addFolder(
  path: string,
  name?: string,
): Promise<MusicFolder | null> {
  const response = await fetcher<ApiResponse<MusicFolder>>(
    '/api/music/folders',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    },
  )
  return response.data ?? null
}

export async function removeFolder(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/music/folders/${id}`,
    { method: 'DELETE' },
  )
  return response.data?.success ?? false
}

export async function syncFolder(id: number): Promise<SyncResult | null> {
  const response = await fetcher<ApiResponse<SyncResult>>(
    `/api/music/folders/${id}/sync`,
    { method: 'POST' },
  )
  return response.data ?? null
}
