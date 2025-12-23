export interface BibleTranslation {
  id: number
  name: string
  abbreviation: string
  language: string
  sourceFilename: string | null
  bookCount: number
  verseCount: number
  createdAt: number
  updatedAt: number
}

export interface BibleBook {
  id: number
  translationId: number
  bookCode: string
  bookName: string
  bookOrder: number
  chapterCount: number
}

export interface BibleVerse {
  id: number
  translationId: number
  bookId: number
  bookCode: string
  bookName: string
  chapter: number
  verse: number
  text: string
}

export interface BibleSearchResult {
  id: number
  translationId: number
  bookId: number
  bookName: string
  bookCode: string
  chapter: number
  verse: number
  text: string
  reference: string
  highlightedText: string
}

export interface BibleChapter {
  chapter: number
  verseCount: number
}

export interface SearchBibleResponse {
  type: 'reference' | 'text'
  results: BibleVerse[] | BibleSearchResult[]
}

export interface CreateTranslationInput {
  name: string
  abbreviation: string
  language: string
  xmlContent: string
}

// Utility function to format verse reference
export function formatVerseReference(
  bookName: string,
  chapter: number,
  verse: number,
  translationAbbreviation?: string,
): string {
  const ref = `${bookName} ${chapter}:${verse}`
  return translationAbbreviation ? `${ref} - ${translationAbbreviation}` : ref
}
