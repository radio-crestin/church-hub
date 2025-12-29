/**
 * Export format options
 */
export type ExportFormat = 'zip' | 'folder'

/**
 * Options for exporting songs
 */
export interface ExportOptions {
  categoryId: number | null // null = all songs
  format: ExportFormat
}

/**
 * Progress tracking for export operation
 */
export interface ExportProgress {
  phase: 'fetching' | 'generating' | 'zipping' | 'writing' | 'saving'
  current: number
  total: number
  currentSong?: string
}

/**
 * Result of an export operation
 */
export interface ExportResult {
  success: boolean
  cancelled?: boolean
  songCount: number
  filename: string
  error?: string
}
