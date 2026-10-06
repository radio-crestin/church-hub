import { fetcher } from '~/utils/fetcher'
import type { SongBundleFile, SongSource } from '../providers/types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

async function call<T>(
  url: string,
  init?: RequestInit & { timeout?: number },
): Promise<T> {
  const response = await fetcher<ApiResponse<T>>(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (response.error) throw new Error(response.error)
  return response.data as T
}

/** Every song source the server knows, built-in first. */
export const getSongSources = () => call<SongSource[]>('/api/song-sources')

/** The songs of a song-bundle source, read by the server. */
export const getSourceSongs = (sourceId: string) =>
  call<SongBundleFile[]>(
    `/api/song-sources/${encodeURIComponent(sourceId)}/songs`,
    // A first read of a large shared folder downloads every song.
    { timeout: 5 * 60_000 },
  )

/** Adds a source from someone's shared link. */
export const addLinkSource = (url: string) =>
  call<SongSource>('/api/song-sources', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })

/** Removes a source added from a link. */
export const deleteLinkSource = (sourceId: string) =>
  call<SongSource[]>(`/api/song-sources/${encodeURIComponent(sourceId)}`, {
    method: 'DELETE',
  })
