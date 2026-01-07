import type { SongSlide } from '../songs'

/**
 * Schedule item types (same as queue)
 */
export type ScheduleItemType = 'song' | 'slide' | 'bible_passage'

/**
 * Slide template types for standalone slides (same as queue)
 */
export type SlideTemplate = 'announcement' | 'versete_tineri' | 'scene'

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
  bible_passage_reference: string | null
  bible_passage_translation: string | null
  obs_scene_name: string | null
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
  // Bible passage fields (present when itemType === 'bible_passage')
  biblePassageReference: string | null
  biblePassageTranslation: string | null
  biblePassageVerses: ScheduleBiblePassageVerse[]
  // Versete Tineri fields (present when itemType === 'slide' && slideType === 'versete_tineri')
  verseteTineriEntries: ScheduleVerseteTineriEntry[]
  // Scene fields (present when itemType === 'slide' && slideType === 'scene')
  obsSceneName: string | null
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
  scheduleId: number
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
  // Scene fields
  obsSceneName?: string
}

/**
 * Bible passage input for updates
 */
export interface BiblePassageInput {
  translationId: number
  translationAbbreviation: string
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
}

/**
 * Input for updating a slide or bible passage in a schedule
 */
export interface UpdateScheduleSlideInput {
  id: number
  // For slide updates
  slideType?: SlideTemplate
  slideContent?: string
  // Versete Tineri entries (for versete_tineri slides)
  verseteTineriEntries?: VerseteTineriEntryInput[]
  // For bible passage updates
  biblePassage?: BiblePassageInput
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
