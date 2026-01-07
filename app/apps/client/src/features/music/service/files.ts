import { fetcher } from '~/utils/fetcher'
import type { MusicFile } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

interface GetFilesParams {
  folderId?: number
  search?: string
  artist?: string
  album?: string
  limit?: number
  offset?: number
}

export async function getFiles(
  params: GetFilesParams = {},
): Promise<MusicFile[]> {
  const searchParams = new URLSearchParams()
  if (params.folderId) searchParams.set('folderId', String(params.folderId))
  if (params.search) searchParams.set('search', params.search)
  if (params.artist) searchParams.set('artist', params.artist)
  if (params.album) searchParams.set('album', params.album)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))

  const query = searchParams.toString()
  const url = query ? `/api/music/files?${query}` : '/api/music/files'

  const response = await fetcher<ApiResponse<MusicFile[]>>(url)
  return response.data ?? []
}

export async function getFileById(id: number): Promise<MusicFile | null> {
  const response = await fetcher<ApiResponse<MusicFile>>(
    `/api/music/files/${id}`,
  )
  return response.data ?? null
}
