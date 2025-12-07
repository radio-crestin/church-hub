import type { SongSlide } from '../songs'

/**
 * Queue item types
 */
export type QueueItemType = 'song' | 'slide'

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
