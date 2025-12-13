/**
 * Options for exporting songs
 */
export interface ExportOptions {
  categoryId: number | null // null = all songs
}

/**
 * Progress tracking for export operation
 */
export interface ExportProgress {
  phase: 'fetching' | 'generating' | 'zipping' | 'saving'
  current: number
  total: number
  currentSong?: string
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  success: boolean
  songCount: number
  filename: string
  error?: string
}
