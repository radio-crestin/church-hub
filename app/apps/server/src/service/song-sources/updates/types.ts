/** What the last check of one song source found. */
export interface SourceUpdate {
  sourceId: string
  name: string
  /** The source's checksum at the check ('' when it offers none). */
  checksum: string
  /** New songs the library lacks, waiting for the user's approval. */
  newCount: number
  /** Songs the library has under another title: for review in Song discovery. */
  similarCount: number
  /** Library songs the source changed, waiting for the user's approval. */
  changedCount: number
  /** Songs the sync added when the source last changed. */
  imported: number
  /** Library songs (not edited by hand) it brought up to date then. */
  updated: number
  checkedAt: number
  /** Why the source could not be checked, when it could not. */
  error?: string
}

/** The song updates: the last run's results and whether one is running. */
export interface SongUpdatesState {
  running: boolean
  /** Sync without approval: add new songs and updates on their own. */
  autoUpdate: boolean
  finishedAt: number | null
  sources: SourceUpdate[]
}

/** What a run is asked to do. */
export interface SongUpdatesRun {
  /** Check every source again, even when its checksum did not change. */
  force: boolean
  autoUpdate: boolean
  /** Only these sources; every source when left out. */
  sourceIds?: string[]
}

/** A song in a notification; `id` once it is in the library. */
export interface SongRef {
  id?: number
  title: string
}

/** Some songs: how many, and the first of them by title. */
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
