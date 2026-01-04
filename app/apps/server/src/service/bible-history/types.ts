/**
 * Bible history item from database
 */
export interface BibleHistoryItem {
  id: number
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  bookName: string
  translationId: number
  bookId: number
  chapter: number
  verse: number
  createdAt: number
}

/**
 * Input for adding a verse to history
 */
export interface AddToHistoryInput {
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  bookName: string
  translationId: number
  bookId: number
  chapter: number
  verse: number
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
