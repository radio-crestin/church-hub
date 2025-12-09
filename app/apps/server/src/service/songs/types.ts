/**
 * Song category record from database
 */
export interface SongCategoryRecord {
  id: number
  name: string
  created_at: number
  updated_at: number
}

/**
 * Song record from database
 */
export interface SongRecord {
  id: number
  title: string
  category_id: number | null
  source_file_path: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  time_signature: string | null
  theme: string | null
  alt_theme: string | null
  hymn_number: string | null
  key_line: string | null
  presentation_order: string | null
  created_at: number
  updated_at: number
}

/**
 * Song slide record from database
 */
export interface SongSlideRecord {
  id: number
  song_id: number
  content: string
  sort_order: number
  label: string | null
  created_at: number
  updated_at: number
}

/**
 * Song category API response format
 */
export interface SongCategory {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

/**
 * Song API response format
 */
export interface Song {
  id: number
  title: string
  categoryId: number | null
  sourceFilePath: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  createdAt: number
  updatedAt: number
}

/**
 * Song slide API response format
 */
export interface SongSlide {
  id: number
  songId: number
  content: string
  sortOrder: number
  label: string | null
  createdAt: number
  updatedAt: number
}

/**
 * Song with slides and category API response format
 */
export interface SongWithSlides extends Song {
  slides: SongSlide[]
  category: SongCategory | null
}

/**
 * Input for creating/updating a song category
 */
export interface UpsertCategoryInput {
  id?: number
  name: string
}

/**
 * Slide input for bulk save
 */
export interface SlideInput {
  id?: number | string // Can be numeric (existing) or string (temp id for new)
  content: string
  sortOrder: number
  label?: string | null
}

/**
 * Input for creating/updating a song
 */
export interface UpsertSongInput {
  id?: number
  title: string
  categoryId?: number | null
  sourceFilePath?: string | null
  author?: string | null
  copyright?: string | null
  ccli?: string | null
  key?: string | null
  tempo?: string | null
  timeSignature?: string | null
  theme?: string | null
  altTheme?: string | null
  hymnNumber?: string | null
  keyLine?: string | null
  presentationOrder?: string | null
  slides?: SlideInput[]
}

/**
 * Input for creating/updating a song slide
 */
export interface UpsertSongSlideInput {
  id?: number
  songId: number
  content: string
  sortOrder?: number
  label?: string | null
}

/**
 * Input for reordering song slides
 */
export interface ReorderSongSlidesInput {
  slideIds: number[]
}

/**
 * Search result item
 */
export interface SongSearchResult {
  id: number
  title: string
  categoryId: number | null
  categoryName: string | null
  matchedContent: string
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
  id?: number
}

/**
 * Input for batch importing songs
 */
export interface BatchImportSongInput {
  title: string
  categoryId?: number | null
  sourceFilePath?: string | null
  author?: string | null
  copyright?: string | null
  ccli?: string | null
  key?: string | null
  tempo?: string | null
  timeSignature?: string | null
  theme?: string | null
  altTheme?: string | null
  hymnNumber?: string | null
  keyLine?: string | null
  presentationOrder?: string | null
  slides?: Array<{
    content: string
    sortOrder: number
    label?: string | null
  }>
}

/**
 * Result of batch import operation
 */
export interface BatchImportResult {
  successCount: number
  failedCount: number
  songIds: number[]
  errors: string[]
}
