import type { SongSlide } from '../songs/types'

/**
 * Schedule item types (same as queue)
 */
export type ScheduleItemType = 'song' | 'slide'

/**
 * Slide template types for standalone slides (same as queue)
 */
export type SlideTemplate = 'announcement' | 'versete_tineri'

/**
 * Schedule list item
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
 * Schedule item
 */
export interface ScheduleItem {
  id: number
  scheduleId: number
  itemType: ScheduleItemType
  songId: number | null
  song: {
    id: number
    title: string
    categoryName: string | null
  } | null
  slides: SongSlide[]
  slideType: SlideTemplate | null
  slideContent: string | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/**
 * Schedule with items
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
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
  afterItemId?: number
}

/**
 * Input for updating a slide in a schedule
 */
export interface UpdateScheduleSlideInput {
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
 * Input for replacing all items in a schedule
 */
export interface ReplaceScheduleItemsInput {
  items: Array<{
    type: 'song' | 'slide'
    songId?: number
    slideType?: SlideTemplate
    slideContent?: string
  }>
}

/**
 * Missing song item (for text editing flow)
 */
export interface MissingSongItem {
  title: string
  lineNumber: number
  resolved?: { type: 'existing'; songId: number } | { type: 'create' }
}
