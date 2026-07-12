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
