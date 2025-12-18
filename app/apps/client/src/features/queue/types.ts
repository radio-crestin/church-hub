import type { SongSlide } from '../songs/types'

/**
 * Queue item types
 */
export type QueueItemType = 'song' | 'slide' | 'bible' | 'bible_passage'

/**
 * Slide template types for standalone slides
 */
export type SlideTemplate = 'announcement' | 'versete_tineri'

/**
 * Bible passage verse (nested within bible_passage queue items)
 */
export interface BiblePassageVerse {
  id: number
  verseId: number
  reference: string
  text: string
  sortOrder: number
}

/**
 * Queue item API response format
 * Supports song items, standalone slide items, bible verse items, and bible passage items
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
  // Bible fields (present when itemType === 'bible')
  bibleVerseId: number | null
  bibleReference: string | null
  bibleText: string | null
  bibleTranslation: string | null
  // Bible passage fields (present when itemType === 'bible_passage')
  biblePassageReference: string | null
  biblePassageTranslation: string | null
  biblePassageVerses: BiblePassageVerse[]
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
  /** Optional: Insert after this queue item ID. If not provided, append to end. */
  afterItemId?: number
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
 * Input for adding a Bible verse to the queue
 */
export interface InsertBibleVerseInput {
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  presentNow?: boolean
  afterItemId?: number
}

/**
 * Input for reordering queue items
 */
export interface ReorderQueueInput {
  itemIds: number[]
}

/**
 * Input for adding a Bible passage (verse range) to the queue
 */
export interface InsertBiblePassageInput {
  translationId: number
  translationAbbreviation: string
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  afterItemId?: number
  presentNow?: boolean
}
