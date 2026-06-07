/**
 * Search engine selector for the ChromaDB experiment.
 * - sqlite: existing FTS5 three-phase search (default)
 * - chroma-semantic: vector search via local MiniLM embeddings
 * - chroma-keyword: ChromaDB document $contains matching
 */
export type SearchEngine = 'sqlite' | 'chroma-semantic' | 'chroma-keyword'

export const SEARCH_ENGINES: SearchEngine[] = [
  'sqlite',
  'chroma-semantic',
  'chroma-keyword',
]

/** app_settings key holding the active search engine */
export const SEARCH_ENGINE_SETTING_KEY = 'search_engine'

export const CHROMA_COLLECTIONS = {
  songs: 'songs',
  bible: 'bible_verses',
  schedules: 'schedules',
} as const

export type ChromaCollectionName =
  (typeof CHROMA_COLLECTIONS)[keyof typeof CHROMA_COLLECTIONS]

export type ChromaSyncState =
  | 'disabled'
  | 'stopped'
  | 'starting'
  | 'syncing'
  | 'ready'
  | 'error'

export interface ChromaSyncStatus {
  state: ChromaSyncState
  /** chroma server port once started */
  port: number | null
  /** per-collection document counts in chroma */
  counts: Record<ChromaCollectionName, number>
  /** sync progress 0..1 while state === 'syncing' */
  progress: number
  /** human-readable current sync step */
  step: string | null
  lastError: string | null
  /** ms duration of the last completed full sync */
  lastFullSyncMs: number | null
  lastFullSyncAt: number | null
}

/** Metadata stored on song documents (one doc per slide + one per title) */
export interface SongDocMetadata {
  songId: number
  kind: 'title' | 'slide'
  slideId?: number
  title: string
  categoryId?: number
  original: string
  hash: string
  [key: string]: string | number | boolean | undefined
}

/** Metadata stored on bible verse documents */
export interface BibleDocMetadata {
  verseId: number
  translationId: number
  bookId: number
  bookCode: string
  bookName: string
  chapter: number
  verse: number
  original: string
  hash: string
  [key: string]: string | number | boolean | undefined
}

/** Metadata stored on schedule documents */
export interface ScheduleDocMetadata {
  scheduleId: number
  title: string
  description?: string
  itemCount: number
  original: string
  hash: string
  [key: string]: string | number | boolean | undefined
}
