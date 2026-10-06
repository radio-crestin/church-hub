import { fetcher } from '~/utils/fetcher'

/** What the server's last check of one song source found. */
export interface SourceUpdate {
  sourceId: string
  name: string
  checksum: string
  /** Songs in the source the library lacks. */
  newCount: number
  /** Songs the automatic update added when the source last changed. */
  imported: number
  checkedAt: number
  error?: string
}

/** GET /api/song-sources/updates */
export interface SongUpdatesState {
  running: boolean
  autoUpdate: boolean
  finishedAt: number | null
  sources: SourceUpdate[]
}

interface ApiResponse<T> {
  data?: T
  error?: string
}

async function call(url: string, method = 'GET', body?: unknown) {
  const response = await fetcher<ApiResponse<SongUpdatesState>>(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.error) throw new Error(response.error)
  return response.data as SongUpdatesState
}

/** Each source's last check for new songs, done by the server. */
export const getSongUpdates = () => call('/api/song-sources/updates')

/** Checks the sources again now (in the server's worker thread). */
export const runSongUpdates = (options: {
  force?: boolean
  sourceIds?: string[]
}) => call('/api/song-sources/updates/run', 'POST', options)

export const setAutoUpdateSongs = (autoUpdate: boolean) =>
  call('/api/song-sources/updates/settings', 'PUT', { autoUpdate })

/** Song discovery's own count of a source's new songs, after comparing them. */
export const recordSourceNewCount = (sourceId: string, newCount: number) =>
  call(`/api/song-sources/${encodeURIComponent(sourceId)}/new-count`, 'PUT', {
    newCount,
  })
