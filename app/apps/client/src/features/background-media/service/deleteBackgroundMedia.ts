import { fetcher } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** Removes an uploaded background file from the server. */
export async function deleteBackgroundMedia(id: string): Promise<void> {
  const res = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/media/backgrounds/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!res.data?.success) {
    throw new Error(res.error || 'Failed to delete background media')
  }
}
