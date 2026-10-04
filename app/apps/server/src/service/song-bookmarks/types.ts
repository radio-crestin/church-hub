export interface SongBookmark {
  id: number
  songId: number
  songTitle: string
  songCategoryName: string | null
  songKeyLine: string | null
  songTagNames: string[]
  sortOrder: number
  /** Manual "already sung" marker toggled from the bookmarks list. */
  isSung: boolean
  /** When it was marked sung (ms epoch), or null. */
  sungAt: number | null
  createdAt: number
}

export interface OperationResult {
  success: boolean
  error?: string
}

/** A line of the Marcaje text that names no song in the library. */
export interface SongBookmarksTextError {
  line: number
  content: string
  reason: 'song_not_found'
}

/**
 * Outcome of replacing the Marcaje from text. `applied` is false when any
 * line failed: then nothing changed.
 */
export interface SongBookmarksTextResult {
  applied: boolean
  songs: number
  notes: number
  errors: SongBookmarksTextError[]
}
