import { fetcher } from '../../../utils/fetcher'
import type {
  AIBibleSearchResponse,
  BibleBook,
  BibleChapter,
  BibleTranslation,
  BibleVerse,
  CreateTranslationInput,
  SearchBibleResponse,
} from '../types'

// Translation operations
export async function getTranslations(): Promise<BibleTranslation[]> {
  const response = await fetcher<{ data: BibleTranslation[] }>(
    '/api/bible/translations',
  )
  return response.data
}

export async function getTranslationById(
  id: number,
): Promise<BibleTranslation> {
  const response = await fetcher<{ data: BibleTranslation }>(
    `/api/bible/translations/${id}`,
  )
  return response.data
}

export async function importTranslation(
  input: CreateTranslationInput,
): Promise<BibleTranslation> {
  const response = await fetcher<{ data: BibleTranslation }>(
    '/api/bible/translations',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return response.data
}

export async function deleteTranslation(id: number): Promise<void> {
  await fetcher(`/api/bible/translations/${id}`, {
    method: 'DELETE',
  })
}

// Book operations
export async function getBooks(translationId: number): Promise<BibleBook[]> {
  const response = await fetcher<{ data: BibleBook[] }>(
    `/api/bible/books/${translationId}`,
  )
  return response.data
}

// Chapter operations
export async function getChapters(bookId: number): Promise<BibleChapter[]> {
  const response = await fetcher<{ data: BibleChapter[] }>(
    `/api/bible/chapters/${bookId}`,
  )
  return response.data
}

// Verse operations
export async function getVerses(
  bookId: number,
  chapter: number,
): Promise<BibleVerse[]> {
  const response = await fetcher<{ data: BibleVerse[] }>(
    `/api/bible/verses/${bookId}/${chapter}`,
  )
  return response.data
}

export async function getVerseById(verseId: number): Promise<BibleVerse> {
  const response = await fetcher<{ data: BibleVerse }>(
    `/api/bible/verse/${verseId}`,
  )
  return response.data
}

// Get next verse in sequence (handles chapter/book boundaries)
export async function getNextVerse(
  verseId: number,
): Promise<BibleVerse | null> {
  try {
    const response = await fetcher<{ data: BibleVerse | null }>(
      `/api/bible/next-verse/${verseId}`,
    )
    return response.data
  } catch {
    return null
  }
}

// Get verse by reference (for multi-translation display)
export async function getVerseByReference(
  translationId: number,
  bookCode: string,
  chapter: number,
  verseNumber: number,
): Promise<BibleVerse | null> {
  try {
    const response = await fetcher<{ data: BibleVerse | null }>(
      `/api/bible/verse-by-reference/${translationId}/${bookCode}/${chapter}/${verseNumber}`,
    )
    return response.data
  } catch {
    return null
  }
}

// Search
export async function searchBible(
  query: string,
  translationId?: number,
  limit?: number,
): Promise<SearchBibleResponse> {
  const params = new URLSearchParams({ q: query })
  if (translationId) params.set('translationId', String(translationId))
  if (limit) params.set('limit', String(limit))

  const response = await fetcher<{ data: SearchBibleResponse }>(
    `/api/bible/search?${params.toString()}`,
  )
  return response.data
}

// AI-enhanced search
export async function aiBibleSearch(
  query: string,
  translationId?: number,
): Promise<AIBibleSearchResponse> {
  const response = await fetcher<{ data: AIBibleSearchResponse }>(
    '/api/bible/ai-search',
    {
      method: 'POST',
      body: JSON.stringify({ query, translationId }),
    },
  )
  return response.data
}
