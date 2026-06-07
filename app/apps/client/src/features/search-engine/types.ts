export type SearchEngine = 'sqlite' | 'chroma-semantic' | 'chroma-keyword'

export const SEARCH_ENGINES: SearchEngine[] = [
  'sqlite',
  'chroma-semantic',
  'chroma-keyword',
]

export type ChromaSyncState =
  | 'disabled'
  | 'stopped'
  | 'starting'
  | 'syncing'
  | 'ready'
  | 'error'

export interface ChromaStatus {
  state: ChromaSyncState
  port: number | null
  counts: {
    songs: number
    bible_verses: number
    schedules: number
  }
  progress: number
  step: string | null
  lastError: string | null
  lastFullSyncMs: number | null
  lastFullSyncAt: number | null
}

export interface SearchEngineInfo {
  configured: SearchEngine
  effective: SearchEngine
  fallback: boolean
  chroma: ChromaStatus
}
