import type { SongSlide } from '../songs'

/**
 * Queue item types
 */
export type QueueItemType = 'song' | 'slide' | 'bible'

/**
 * Slide template types for standalone slides
 */
export type SlideTemplate = 'announcement' | 'versete_tineri'

/**
 * Queue item record from database
 */
export interface QueueItemRecord {
  id: number
  item_type: QueueItemType
  song_id: number | null
  slide_type: SlideTemplate | null
  slide_content: string | null
  bible_verse_id: number | null
  bible_reference: string | null
  bible_text: string | null
  bible_translation: string | null
  sort_order: number
  is_expanded: number
  created_at: number
  updated_at: number
}

/**
 * Queue item with song data joined (for song items)
 */
export interface QueueItemWithSongRecord extends QueueItemRecord {
  song_title: string | null
  category_name: string | null
}

/**
 * Queue item API response format
 */
export interface QueueItem {
  id: number
  itemType: QueueItemType
  // Song fields (present when itemType === 'song')
  songId: number | null
  song: {
    id: number
    title: string
    categoryName: string | null
  } | null
  slides: SongSlide[]
  // Standalone slide fields (present when itemType === 'slide')
  slideType: SlideTemplate | null
  slideContent: string | null
  // Bible verse fields (present when itemType === 'bible')
  bibleVerseId: number | null
  bibleReference: string | null
  bibleText: string | null
  bibleTranslation: string | null
  // Common fields
  sortOrder: number
  isExpanded: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Input for adding a song to the queue
 */
export interface AddToQueueInput {
  songId: number
  presentNow?: boolean
  /** Optional: Insert after this queue item ID. If not provided, append to end. */
  afterItemId?: number
}

/**
 * Input for inserting a standalone slide to the queue
 */
export interface InsertSlideInput {
  slideType: SlideTemplate
  slideContent: string
  afterItemId?: number
}

/**
 * Input for inserting a Bible verse to the queue
 */
export interface InsertBibleVerseInput {
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  afterItemId?: number
}

/**
 * Input for updating a standalone slide in the queue
 */
export interface UpdateSlideInput {
  id: number
  slideType: SlideTemplate
  slideContent: string
}

/**
 * Input for reordering queue items
 */
export interface ReorderQueueInput {
  itemIds: number[]
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
