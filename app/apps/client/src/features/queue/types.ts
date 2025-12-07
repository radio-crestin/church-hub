import type { SongSlide } from '../songs/types'

/**
 * Queue item types
 */
export type QueueItemType = 'song' | 'slide'

/**
 * Slide template types for standalone slides
 */
export type SlideTemplate = 'announcement' | 'versete_tineri'

/**
 * Queue item API response format
 * Supports both song items and standalone slide items
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
