import type { ChurchProgramData } from '../schedule-export/types'

/**
 * Result of parsing a church program file
 */
export interface ParseChurchProgramResult {
  success: boolean
  data?: ChurchProgramData
  error?: string
}

/**
 * Result of importing a schedule
 */
export interface ImportScheduleResult {
  success: boolean
  scheduleId?: number
  songsCreated?: number
  cancelled?: boolean
  error?: string
}
