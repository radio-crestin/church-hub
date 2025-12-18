import { useCallback, useState } from 'react'

export type BibleNavigationLevel = 'books' | 'chapters' | 'verses'

export interface BibleNavigationState {
  translationId: number | undefined
  bookId: number | undefined
  bookName: string | undefined
  chapter: number | undefined
  /** The verse currently displayed on screen (green highlight) */
  presentedIndex: number | null
  /** The verse found by search navigation (indigo highlight) */
  searchedIndex: number | null
  searchQuery: string
  level: BibleNavigationLevel
}

export interface NavigateToVerseParams {
  translationId: number
  bookId: number
  bookName: string
  chapter: number
  verseIndex: number
}

export interface NavigateToChapterParams {
  bookId: number
  bookName: string
  chapter: number
  verseIndex?: number
  clearSearch?: boolean
}

export interface UseBibleNavigationReturn {
  state: BibleNavigationState
  selectTranslation: (id: number) => void
  selectBook: (bookId: number, bookName: string, clearSearch?: boolean) => void
  selectChapter: (chapter: number) => void
  /** Sets the presented index (verse displayed on screen) */
  presentVerse: (index: number) => void
  /** Moves to next verse and presents it */
  nextVerse: () => void
  /** Moves to previous verse and presents it */
  previousVerse: () => void
  /** Clears the presentation */
  clearPresentation: () => void
  goBack: () => void
  setSearchQuery: (query: string) => void
  clearSearch: () => void
  reset: () => void
  navigateToVerse: (params: NavigateToVerseParams) => void
  navigateToChapter: (params: NavigateToChapterParams) => void
}

const initialState: BibleNavigationState = {
  translationId: undefined,
  bookId: undefined,
  bookName: undefined,
  chapter: undefined,
  presentedIndex: null,
  searchedIndex: null,
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
    setState(() => ({
      ...initialState,
      translationId: id,
    }))
  }, [])

  const selectBook = useCallback(
    (bookId: number, bookName: string, clearSearch = true) => {
      setState((prev) => ({
        ...prev,
        bookId,
        bookName,
        chapter: undefined,
        presentedIndex: null,
        searchedIndex: null,
        level: 'chapters',
        searchQuery: clearSearch ? '' : prev.searchQuery,
      }))
    },
    [],
  )

  const selectChapter = useCallback((chapter: number) => {
    setState((prev) => ({
      ...prev,
      chapter,
      presentedIndex: null,
      searchedIndex: null,
      level: 'verses',
    }))
  }, [])

  /** Sets the presented index */
  const presentVerse = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      presentedIndex: index,
    }))
  }, [])

  /** Moves to next verse and presents it */
  const nextVerse = useCallback(() => {
    setState((prev) => ({
      ...prev,
      presentedIndex: (prev.presentedIndex ?? prev.searchedIndex ?? -1) + 1,
      searchedIndex: null, // Clear search highlight when presenting
    }))
  }, [])

  /** Moves to previous verse and presents it */
  const previousVerse = useCallback(() => {
    setState((prev) => ({
      ...prev,
      presentedIndex: Math.max(
        0,
        (prev.presentedIndex ?? prev.searchedIndex ?? 1) - 1,
      ),
      searchedIndex: null, // Clear search highlight when presenting
    }))
  }, [])

  const clearPresentation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      // Preserve last presented verse in searchedIndex for visual reference
      searchedIndex: prev.presentedIndex,
      presentedIndex: null,
    }))
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.level === 'verses') {
        return {
          ...prev,
          chapter: undefined,
          presentedIndex: null,
          searchedIndex: null,
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

  /** Navigate to a specific verse (used on initial sync from presentation) */
  const navigateToVerse = useCallback((params: NavigateToVerseParams) => {
    setState({
      translationId: params.translationId,
      bookId: params.bookId,
      bookName: params.bookName,
      chapter: params.chapter,
      presentedIndex: params.verseIndex,
      searchedIndex: null,
      searchQuery: '',
      level: 'verses',
    })
  }, [])

  /** Navigate to chapter (used by reference search) */
  const navigateToChapter = useCallback((params: NavigateToChapterParams) => {
    setState((prev) => ({
      ...prev,
      bookId: params.bookId,
      bookName: params.bookName,
      chapter: params.chapter,
      presentedIndex: null, // Clear presented verse when navigating via search
      searchedIndex: params.verseIndex ?? null,
      searchQuery: params.clearSearch === false ? prev.searchQuery : '',
      level: 'verses',
    }))
  }, [])

  return {
    state,
    selectTranslation,
    selectBook,
    selectChapter,
    presentVerse,
    nextVerse,
    previousVerse,
    clearPresentation,
    goBack,
    setSearchQuery,
    clearSearch,
    reset,
    navigateToVerse,
    navigateToChapter,
  }
}
