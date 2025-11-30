/**
 * Schedule item types
 */
export type ScheduleItemType = 'song' | 'bible' | 'text' | 'section'

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
 * Schedule item with resolved content
 */
export interface ScheduleItemResolved {
  id: number
  schedule_id: number
  position: number
  item_type: ScheduleItemType
  content_id: number | null
  content_data: string | null
  notes: string | null
  title: string
  created_at: number
  updated_at: number
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
  content_id?: number
  content_data?: string
  notes?: string
  position?: number
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data?: T
  error?: string
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
 * Input for reordering schedule items
 */
export interface ReorderItemsInput {
  items: Array<{ id: number; position: number }>
}
