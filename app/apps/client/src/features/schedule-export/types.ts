import type { SlideTemplate } from '../schedules/types'

/**
 * Schedule export format types
 */
export type ScheduleExportFormat = 'churchprogram' | 'pptx'

/**
 * Song data embedded in a church program export
 */
export interface ExportedSong {
  title: string
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  slides: ExportedSlide[]
}

/**
 * Slide data in a church program export
 */
export interface ExportedSlide {
  content: string
  label: string | null
  sortOrder: number
}

/**
 * Schedule item in a church program export
 */
export interface ExportedScheduleItem {
  itemType: 'song' | 'slide'
  sortOrder: number
  song?: ExportedSong
  slideType?: SlideTemplate
  slideContent?: string
}

/**
 * Schedule metadata in a church program export
 */
export interface ExportedSchedule {
  title: string
  description: string | null
}

/**
 * Complete church program file format
 */
export interface ChurchProgramData {
  version: number
  type: 'churchprogram'
  schedule: ExportedSchedule
  items: ExportedScheduleItem[]
}
