import { useCallback, useState } from 'react'

export type BibleNavigationLevel = 'books' | 'chapters' | 'verses'

export interface BibleNavigationState {
  translationId: number | undefined
  bookId: number | undefined
  bookName: string | undefined
  chapter: number | undefined
  verseIndex: number
  presentedVerseIndex: number | null
  searchQuery: string
  level: BibleNavigationLevel
}

export interface UseBibleNavigationReturn {
  state: BibleNavigationState
  selectTranslation: (id: number) => void
  selectBook: (bookId: number, bookName: string) => void
  selectChapter: (chapter: number) => void
  selectVerse: (index: number) => void
  presentVerse: (index: number) => void
  clearPresentation: () => void
  nextVerse: () => void
  previousVerse: () => void
  goBack: () => void
  setSearchQuery: (query: string) => void
  clearSearch: () => void
  reset: () => void
}

const initialState: BibleNavigationState = {
  translationId: undefined,
  bookId: undefined,
  bookName: undefined,
  chapter: undefined,
  verseIndex: 0,
  presentedVerseIndex: null,
  searchQuery: '',
  level: 'books',
}

export function useBibleNavigation(
  initialTranslationId?: number,
): UseBibleNavigationReturn {
  const [state, setState] = useState<BibleNavigationState>({
    ...initialState,
    translationId: initialTranslationId,
  })

  const selectTranslation = useCallback((id: number) => {
    setState((prev) => ({
      ...initialState,
      translationId: id,
    }))
  }, [])

  const selectBook = useCallback((bookId: number, bookName: string) => {
    setState((prev) => ({
      ...prev,
      bookId,
      bookName,
      chapter: undefined,
      verseIndex: 0,
      level: 'chapters',
      searchQuery: '',
    }))
  }, [])

  const selectChapter = useCallback((chapter: number) => {
    setState((prev) => ({
      ...prev,
      chapter,
      verseIndex: 0,
      level: 'verses',
    }))
  }, [])

  const selectVerse = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      verseIndex: index,
    }))
  }, [])

  const presentVerse = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      verseIndex: index,
      presentedVerseIndex: index,
    }))
  }, [])

  const clearPresentation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      presentedVerseIndex: null,
    }))
  }, [])

  const nextVerse = useCallback(() => {
    setState((prev) => ({
      ...prev,
      verseIndex: prev.verseIndex + 1,
    }))
  }, [])

  const previousVerse = useCallback(() => {
    setState((prev) => ({
      ...prev,
      verseIndex: Math.max(0, prev.verseIndex - 1),
    }))
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.level === 'verses') {
        return {
          ...prev,
          chapter: undefined,
          verseIndex: 0,
          level: 'chapters',
        }
      }
      if (prev.level === 'chapters') {
        return {
          ...prev,
          bookId: undefined,
          bookName: undefined,
          level: 'books',
        }
      }
      return prev
    })
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({
      ...prev,
      searchQuery: query,
    }))
  }, [])

  const clearSearch = useCallback(() => {
    setState((prev) => ({
      ...prev,
      searchQuery: '',
    }))
  }, [])

  const reset = useCallback(() => {
    setState((prev) => ({
      ...initialState,
      translationId: prev.translationId,
    }))
  }, [])

  return {
    state,
    selectTranslation,
    selectBook,
    selectChapter,
    selectVerse,
    presentVerse,
    clearPresentation,
    nextVerse,
    previousVerse,
    goBack,
    setSearchQuery,
    clearSearch,
    reset,
  }
}
