import { getApiUrl } from '~/config'
import { fetcher } from '~/utils/fetcher'
import { getAuthHeaders } from '~/utils/getAuthHeaders'
import type { Publication, S3Storage, S3StorageInput } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher<ApiResponse<T>>(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    // Publishing uploads one file per song; a large category takes a while.
    timeout: 5 * 60_000,
  })
  if (response.error) throw new Error(response.error)
  return response.data as T
}

export const getS3Storage = () =>
  call<S3Storage | null>('/api/song-sources/storage')

export const saveS3Storage = (input: S3StorageInput) =>
  call<S3Storage>('/api/song-sources/storage', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

export const getPublications = () =>
  call<Publication[]>('/api/song-sources/publications')

export const publishCategory = (categoryId: number) =>
  call<Publication[]>('/api/song-sources/publications', {
    method: 'POST',
    body: JSON.stringify({ categoryId }),
  })

export const syncPublication = (id: number) =>
  call<Publication[]>(`/api/song-sources/publications/${id}/sync`, {
    method: 'POST',
  })

export const unpublish = (id: number) =>
  call<Publication[]>(`/api/song-sources/publications/${id}`, {
    method: 'DELETE',
  })

/** A category as a `.chsongs` file's bytes. */
export async function exportCategoryFile(
  categoryId: number,
): Promise<Uint8Array> {
  const response = await fetch(
    `${getApiUrl()}/api/song-sources/export?categoryId=${categoryId}`,
    { credentials: 'include', headers: getAuthHeaders() },
  )
  if (!response.ok) throw new Error(`Export failed: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}
