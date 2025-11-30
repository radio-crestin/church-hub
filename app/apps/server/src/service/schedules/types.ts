/**
 * Schedule item types
 */
export type ScheduleItemType = 'song' | 'bible' | 'text' | 'section'

/**
 * Bible reference data
 */
export interface BibleReference {
  book: string
  chapter: number
  verseStart: number
  verseEnd?: number
  translation?: string
}

/**
 * Custom text data
 */
export interface CustomTextData {
  title?: string
  content: string
}

/**
 * Section header data
 */
export interface SectionData {
  title: string
}

/**
 * Content data union type
 */
export type ItemContentData = BibleReference | CustomTextData | SectionData

/**
 * Schedule record
 */
export interface Schedule {
  id: number
  title: string
  description: string | null
  created_at: number
  updated_at: number
}

/**
 * Schedule item record
 */
export interface ScheduleItem {
  id: number
  schedule_id: number
  position: number
  item_type: ScheduleItemType
  content_id: number | null
  content_data: string | null // JSON stringified ItemContentData
  notes: string | null
  created_at: number
  updated_at: number
}

/**
 * Schedule item with resolved content
 */
export interface ScheduleItemResolved extends ScheduleItem {
  title: string // Resolved title (song title, Bible ref, etc.)
}

/**
 * Schedule with items
 */
export interface ScheduleWithItems extends Schedule {
  items: ScheduleItemResolved[]
}

/**
 * Input for creating a schedule
 */
export interface CreateScheduleInput {
  title: string
  description?: string
}

/**
 * Input for updating a schedule
 */
export interface UpdateScheduleInput {
  title?: string
  description?: string
}

/**
 * Input for adding an item to a schedule
 */
export interface AddScheduleItemInput {
  item_type: ScheduleItemType
  content_id?: number // For songs
  content_data?: ItemContentData // For Bible, text, section
  notes?: string
  position?: number // If not provided, adds at end
}

/**
 * Input for reordering schedule items
 */
export interface ReorderItemsInput {
  items: Array<{
    id: number
    position: number
  }>
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
  id?: number
}
