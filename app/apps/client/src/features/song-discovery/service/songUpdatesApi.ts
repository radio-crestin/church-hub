import { fetcher } from '~/utils/fetcher'

/** What the server's last check of one song source found. */
export interface SourceUpdate {
  sourceId: string
  name: string
  checksum: string
  /** New songs the library lacks, waiting for approval. */
  newCount: number
  /** Songs the library has under another title: for review here. */
  similarCount: number
  /** Library songs the source changed, waiting for approval. */
  changedCount: number
  /** Songs the sync added when the source last changed. */
  imported: number
  /** Library songs it brought up to date then. */
  updated: number
  checkedAt: number
  error?: string
}

/** A song in a notification; `id` once it is in the library. */
export interface SongRef {
  id?: number
  title: string
}

/** Some songs: how many, and the first of them. */
export interface SongSet {
  count: number
  songs: SongRef[]
}

/** One source's songs added and updated (or to add and update). */
export interface SourceSongChanges {
  sourceId: string
  name: string
  added: SongSet
  updated: SongSet
}

/** A songs-synced or songs-pending notification's details. */
export interface SongSyncData {
  sources: SourceSongChanges[]
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

/** Stops the running check; what it synced so far stays. */
export const cancelSongUpdates = () =>
  call('/api/song-sources/updates/cancel', 'POST')

/** Syncs the songs waiting for approval: new songs and updates. */
export const syncPendingSongs = () =>
  call('/api/song-sources/updates/sync', 'POST')

/** Counts a source's waiting songs again, after an import here. */
export const recountSourceSongs = (sourceId: string) =>
  call(`/api/song-sources/${encodeURIComponent(sourceId)}/recount`, 'POST')
