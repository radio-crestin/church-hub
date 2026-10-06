import type { ParsedOpenSong } from '@church-hub/song-formats'

import { getApiUrl } from '~/config'
import { fetcher } from '~/utils/fetcher'
import { getAuthHeaders } from '~/utils/getAuthHeaders'
import type { SongBundleFile, SongSource } from '../providers/types'
import type { DiscoveryMatchResult } from '../types'

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

/** A shared folder's OpenSong files, read by the server. */
export const getSourceSongs = (sourceId: string) =>
  call<SongBundleFile[]>(
    `/api/song-sources/${encodeURIComponent(sourceId)}/songs`,
    // A first read of a large shared folder downloads every song.
    { timeout: 5 * 60_000 },
  )

/** What changes when a source's songs do ('' when it offers nothing). */
export const getSourceChecksum = async (sourceId: string) =>
  (
    await call<{ checksum: string }>(
      `/api/song-sources/${encodeURIComponent(sourceId)}/checksum`,
    )
  ).checksum

/**
 * A song file source's archive, downloaded through the server, reporting
 * bytes received as they arrive.
 */
export async function downloadSourceArchive(
  sourceId: string,
  onProgress?: (received: number, total: number | null) => void,
): Promise<Uint8Array> {
  const response = await fetch(
    `${getApiUrl()}/api/song-sources/${encodeURIComponent(sourceId)}/archive`,
    { credentials: 'include', headers: getAuthHeaders() },
  )
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status}`)
  }
  const total = Number(response.headers.get('content-length')) || null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    chunks.push(r.value)
    received += r.value.length
    onProgress?.(received, total)
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

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

/** A song of a source the library lacks, from the server's last check. */
export interface LackingSong {
  id: string
  sourceFilename: string | null
  parsed: ParsedOpenSong
  verdict: 'new' | 'similar'
  similar: DiscoveryMatchResult['similar']
}

/** The songs a source has that the library lacks (the server's last check). */
export const getLackingSongs = (sourceId: string) =>
  call<LackingSong[]>(
    `/api/song-sources/${encodeURIComponent(sourceId)}/lacking`,
  )
