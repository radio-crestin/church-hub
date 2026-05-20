/**
 * Chord annotation mapping a word position to a chord name
 */
export interface ChordMapping {
  wordIndex: number
  chord: string
}

/**
 * Song category record from database
 */
export interface SongCategoryRecord {
  id: number
  name: string
  priority: number
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
  source_filename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  time_signature: string | null
  theme: string | null
  alt_theme: string | null
  hymn_number: string | null
  key_line: string | null
  presentation_order: string | null
  presentation_count: number
  last_presented_at: number | null
  last_manual_edit: number | null
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
  chords: string | null // JSON string of ChordMapping[]
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
  priority: number
  songCount: number
  createdAt: number
  updatedAt: number
}

/**
 * Song tag API response format
 *
 * Tags are an orthogonal classification axis to categories: a song has at
 * most one category but can have multiple tags (e.g. "youth", "men",
 * "sisters", "children"). Used for filtering / scheduling by audience.
 */
export interface SongTag {
  id: number
  name: string
  sortOrder: number
  songCount: number
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
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  lastPresentedAt: number | null
  lastManualEdit: number | null
  createdAt: number
  updatedAt: number
  /**
   * Tag names attached to this song, in display order. Only populated by
   * endpoints that need it for list rendering (e.g. paginated browse); the
   * legacy `getAllSongs` path leaves it undefined to avoid the extra join.
   */
  tagNames?: string[]
}

/**
 * Song slide API response format
 */
export interface SongSlide {
  id: number
  songId: number
  content: string
  chords: ChordMapping[] | null
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
  tags: SongTag[]
}

/**
 * Input for creating/updating a song category
 */
export interface UpsertCategoryInput {
  id?: number
  name: string
  priority?: number
}

/**
 * Input for creating/updating a song tag
 */
export interface UpsertTagInput {
  id?: number
  name: string
  sortOrder?: number
}

/**
 * Input for reordering song tags
 */
export interface ReorderTagsInput {
  tagIds: number[]
}

/**
 * Slide input for bulk save
 */
export interface SlideInput {
  id?: number | string // Can be numeric (existing) or string (temp id for new)
  content: string
  chords?: ChordMapping[] | null
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
  sourceFilename?: string | null
  author?: string | null
  copyright?: string | null
  ccli?: string | null
  tempo?: string | null
  timeSignature?: string | null
  theme?: string | null
  altTheme?: string | null
  hymnNumber?: string | null
  keyLine?: string | null
  presentationOrder?: string | null
  presentationCount?: number
  slides?: SlideInput[]
  /**
   * Tag memberships for this song. When omitted the existing assignments
   * are left untouched; when provided the set is replaced wholesale (empty
   * array clears all assignments).
   */
  tagIds?: number[]
  /** Whether this is a manual edit from the UI (sets last_manual_edit timestamp) */
  isManualEdit?: boolean
}

/**
 * Input for creating/updating a song slide
 */
export interface UpsertSongSlideInput {
  id?: number
  songId: number
  content: string
  chords?: ChordMapping[] | null
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
 * Input for reordering song categories
 */
export interface ReorderCategoriesInput {
  categoryIds: number[]
}

/**
 * Search result item
 */
export interface SongSearchResult {
  id: number
  title: string
  categoryId: number | null
  categoryName: string | null
  keyLine: string | null
  highlightedTitle: string
  matchedContent: string
  presentationCount: number
  score: number
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
  sourceFilename?: string | null
  author?: string | null
  copyright?: string | null
  ccli?: string | null
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
  skippedCount: number
  songIds: number[]
  errors: string[]
}
