import type { SongSlide } from '../songs/types'

/**
 * Schedule item types (same as queue)
 */
export type ScheduleItemType = 'song' | 'slide' | 'bible_passage'

/**
 * Slide template types for standalone slides (same as queue)
 */
export type SlideTemplate = 'announcement' | 'versete_tineri'

/**
 * Bible passage verse (nested within bible_passage schedule items)
 */
export interface ScheduleBiblePassageVerse {
  id: number
  verseId: number
  reference: string
  text: string
  sortOrder: number
}

/**
 * Versete Tineri entry (nested within versete_tineri slides)
 */
export interface ScheduleVerseteTineriEntry {
  id: number
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
  // Bible passage fields (present when itemType === 'bible_passage')
  biblePassageReference: string | null
  biblePassageTranslation: string | null
  biblePassageVerses: ScheduleBiblePassageVerse[]
  // Versete Tineri fields (present when itemType === 'slide' && slideType === 'versete_tineri')
  verseteTineriEntries: ScheduleVerseteTineriEntry[]
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
 * Single entry for Versete Tineri input
 */
export interface VerseteTineriEntryInput {
  personName: string
  translationId: number
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
}

/**
 * Input for adding an item to a schedule
 */
export interface AddToScheduleInput {
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
  afterItemId?: number
  // Bible passage fields
  biblePassage?: {
    translationId: number
    translationAbbreviation: string
    bookCode: string
    bookName: string
    startChapter: number
    startVerse: number
    endChapter: number
    endVerse: number
  }
  // Versete Tineri entries
  verseteTineriEntries?: VerseteTineriEntryInput[]
}

/**
 * Input for updating a slide in a schedule
 */
export interface UpdateScheduleSlideInput {
  slideType: SlideTemplate
  slideContent?: string
  // Versete Tineri entries (for versete_tineri slides)
  verseteTineriEntries?: VerseteTineriEntryInput[]
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
    // Bible passage fields
    biblePassage?: {
      translationId: number
      translationAbbreviation: string
      bookCode: string
      bookName: string
      startChapter: number
      startVerse: number
      endChapter: number
      endVerse: number
    }
    // Versete Tineri entries
    verseteTineriEntries?: VerseteTineriEntryInput[]
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
