import { fetchJsonWithStatus } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
  code?: string
}

/** A refusal, with the code the UI words it by (cloud_sync_off…). */
export class SongLinkError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'SongLinkError'
  }
}

async function call<T>(url: string, method: 'GET' | 'POST' | 'DELETE') {
  const { body } = await fetchJsonWithStatus<ApiResponse<T>>(url, {
    method,
    timeout: 60_000,
  })
  if (body.data === undefined) {
    throw new SongLinkError(body.code ?? body.error ?? 'failed')
  }
  return body.data
}

/** Shares the song by link; the public page the link opens. */
export function shareSongLink(songId: number): Promise<{ url: string }> {
  return call(`/api/song-links/${songId}`, 'POST')
}

/** Stops the song's link. */
export function unshareSongLink(songId: number): Promise<null> {
  return call(`/api/song-links/${songId}`, 'DELETE')
}

/** This device's copy of a shared song, by the church's uuid. */
export function findSharedSong(uuid: string): Promise<{ songId: number }> {
  return call(`/api/song-links/by-uuid/${encodeURIComponent(uuid)}`, 'GET')
}
