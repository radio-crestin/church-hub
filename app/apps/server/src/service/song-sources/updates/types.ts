/** What the last check of one song source found. */
export interface SourceUpdate {
  sourceId: string
  name: string
  /** The source's checksum at the check ('' when it offers none). */
  checksum: string
  /** Songs in the source the library lacks (new or a different version). */
  newCount: number
  /** Songs the automatic update added when the source last changed. */
  imported: number
  /** Library songs (not edited by hand) it brought up to date then. */
  updated?: number
  checkedAt: number
  /** Why the source could not be checked, when it could not. */
  error?: string
}

/** The song updates: the last run's results and whether one is running. */
export interface SongUpdatesState {
  running: boolean
  /** Update songs automatically: add a source's new songs on their own. */
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
