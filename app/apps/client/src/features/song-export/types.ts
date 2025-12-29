/**
 * Export destination format (how files are packaged)
 */
export type ExportDestination = 'zip' | 'folder'

/**
 * File format for exported songs
 */
export type SongFileFormat = 'opensong' | 'pptx'

/**
 * Options for exporting songs
 */
export interface ExportOptions {
  categoryId: number | null // null = all songs
  destination: ExportDestination
  fileFormat: SongFileFormat
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
