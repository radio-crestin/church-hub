import type { SongSlide } from '../songs'

/**
 * Schedule item types (same as queue)
 */
export type ScheduleItemType = 'song' | 'slide'

/**
 * Slide template types for standalone slides (same as queue)
 */
export type SlideTemplate = 'announcement' | 'versete_tineri'

/**
 * Schedule record from database
 */
export interface ScheduleRecord {
  id: number
  title: string
  description: string | null
  created_at: number
  updated_at: number
}

/**
 * Schedule API response format
 */
export interface Schedule {
  id: number
  title: string
  description: string | null
  itemCount: number
  songCount: number
  createdAt: number
  updatedAt: number
}

/**
 * Schedule item record from database
 */
export interface ScheduleItemRecord {
  id: number
  schedule_id: number
  item_type: ScheduleItemType
  song_id: number | null
  slide_type: SlideTemplate | null
  slide_content: string | null
  sort_order: number
  created_at: number
  updated_at: number
}

/**
 * Schedule item with song data joined
 */
export interface ScheduleItemWithSongRecord extends ScheduleItemRecord {
  song_title: string | null
  category_name: string | null
}

/**
 * Schedule item API response format
 */
export interface ScheduleItem {
  id: number
  scheduleId: number
  itemType: ScheduleItemType
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
  createdAt: number
  updatedAt: number
}

/**
 * Schedule with items API response format
 */
export interface ScheduleWithItems extends Schedule {
  items: ScheduleItem[]
}

/**
 * Input for creating/updating a schedule
 */
export interface UpsertScheduleInput {
  id?: number
  title: string
  description?: string | null
}

/**
 * Input for adding an item to a schedule
 */
export interface AddToScheduleInput {
  scheduleId: number
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
  afterItemId?: number
}

/**
 * Input for updating a slide in a schedule
 */
export interface UpdateScheduleSlideInput {
  id: number
  slideType: SlideTemplate
  slideContent: string
}

/**
 * Input for reordering schedule items
 */
export interface ReorderScheduleItemsInput {
  itemIds: number[]
}

/**
 * Schedule search result
 */
export interface ScheduleSearchResult {
  id: number
  title: string
  description: string | null
  itemCount: number
  matchedContent: string
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
