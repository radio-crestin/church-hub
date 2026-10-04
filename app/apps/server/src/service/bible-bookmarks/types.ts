/**
 * A run of styling drawn over the verse text, by character offset.
 *
 * Mirrors the live slide's `TextStyleRange` so a saved bookmark can be poured
 * straight back onto the screen. Offsets count from the start of the verse
 * text, never from whatever a screen puts in front of it.
 */
export interface BibleBookmarkStyleRange {
  id: string
  start: number
  end: number
  highlight?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontScale?: number
}

/**
 * A bookmarked Bible verse.
 *
 * Verse fields are denormalized so a bookmark keeps reading correctly even if
 * the translation it came from is deleted and re-imported with new row ids.
 */
export interface BibleBookmark {
  id: number
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  bookName: string
  bookCode: string
  translationId: number
  bookId: number
  chapter: number
  verse: number
  sortOrder: number
  /**
   * The verse as standard Markdown with its highlights, bold and underline -
   * what is stored, exported and imported.
   */
  markdown: string
  /** The same styling read out of `markdown`, empty when none. */
  styleRanges: BibleBookmarkStyleRange[]
  createdAt: number
}

/**
 * A free-text separator row that lives in the same ordered list as bookmarks
 */
export interface BibleBookmarkNote {
  id: number
  content: string
  sortOrder: number
  createdAt: number
}

/**
 * Reference to one row of the merged bookmark list, used when reordering
 */
export interface BibleBookmarkItemRef {
  type: 'verse' | 'note'
  id: number
}

/**
 * One line of an import that could not be turned into a bookmark
 */
export interface BibleBookmarkImportError {
  line: number
  content: string
  reason:
    | 'unknown_reference'
    | 'verse_required'
    | 'verse_not_found'
    | 'no_translation'
    /** Imported, but without the styles: the text under it is not the verse. */
    | 'text_mismatch'
}

/**
 * Outcome of importing bookmarks from text
 */
export interface BibleBookmarkImportResult {
  imported: number
  notes: number
  errors: BibleBookmarkImportError[]
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
