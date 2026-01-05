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
 * Bible passage verse in a church program export
 */
export interface ExportedBiblePassageVerse {
  verseId: number
  reference: string
  text: string
  sortOrder: number
}

/**
 * Bible passage data in a church program export
 * Note: Only reference and translation abbreviation are stored in the schedule.
 * Full verse details would need to be looked up on import.
 */
export interface ExportedBiblePassage {
  reference: string
  translationAbbreviation: string
  verses: ExportedBiblePassageVerse[]
}

/**
 * Versete Tineri entry in a church program export
 */
export interface ExportedVerseteTineriEntry {
  personName: string
  translationId: number
  bookCode: string
  bookName: string
  reference: string
  text: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  sortOrder: number
}

/**
 * Schedule item in a church program export
 */
export interface ExportedScheduleItem {
  itemType: 'song' | 'slide' | 'bible_passage'
  sortOrder: number
  song?: ExportedSong
  slideType?: SlideTemplate
  slideContent?: string
  biblePassage?: ExportedBiblePassage
  verseteTineriEntries?: ExportedVerseteTineriEntry[]
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
