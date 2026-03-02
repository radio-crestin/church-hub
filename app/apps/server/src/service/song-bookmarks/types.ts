export interface SongBookmark {
  id: number
  songId: number
  songTitle: string
  songCategoryName: string | null
  songKeyLine: string | null
  sortOrder: number
  createdAt: number
}

export interface OperationResult {
  success: boolean
  error?: string
}
