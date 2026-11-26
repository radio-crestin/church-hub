import { fetchJsonWithStatus } from '~/utils/fetcher'
import type {
  CuratorDecision,
  CuratorStatus,
  LibrarySubmission,
} from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
  code?: string
}

/** A refusal, with the code the UI words it by (rate_limited, not_curator…). */
export class SongLibraryError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code)
    this.name = 'SongLibraryError'
  }
}

/** Publishing downloads and uploads a shard: give it time. */
const TIMEOUT_MS = 90_000

async function call<T>(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<T> {
  const { status, body: json } = await fetchJsonWithStatus<ApiResponse<T>>(
    url,
    {
      method,
      timeout: TIMEOUT_MS,
      ...(body !== undefined && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    },
  )
  if (json.data === undefined) {
    throw new SongLibraryError(json.code ?? json.error ?? 'failed', status)
  }
  return json.data
}

/** Sends a song to the Church Hub Library's curators. */
export function submitSongToLibrary(
  songId: number,
  note: string,
): Promise<{ id: string }> {
  return call(`/api/songs/${songId}/library-submission`, 'POST', { note })
}

export function getCuratorStatus(): Promise<CuratorStatus> {
  return call('/api/song-library/curator', 'GET')
}

export function listLibrarySubmissions(): Promise<LibrarySubmission[]> {
  return call('/api/song-library/submissions', 'GET')
}

export function searchLibrarySongs(
  query: string,
): Promise<Array<{ id: string; title: string }>> {
  return call(`/api/song-library/songs?q=${encodeURIComponent(query)}`, 'GET')
}

export function decideLibrarySubmission(
  id: string,
  decision: CuratorDecision,
): Promise<{ librarySongId: string | null }> {
  return call(
    `/api/song-library/submissions/${encodeURIComponent(id)}/decision`,
    'POST',
    decision,
  )
}
