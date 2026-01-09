import { useCallback, useEffect, useRef, useState } from 'react'

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
  /** When true, sets searchedIndex instead of presentedIndex (selects verse without presenting) */
  selectOnly?: boolean
}

export interface UseBibleNavigationReturn {
  state: BibleNavigationState
  selectTranslation: (id: number) => void
  selectBook: (bookId: number, bookName: string, clearSearch?: boolean) => void
  selectChapter: (chapter: number) => void
  /** Sets the presented index (verse displayed on screen) */
  presentVerse: (index: number) => void
  /** Sets the searched index (verse highlighted but not presented) */
  setSearchedIndex: (index: number | null) => void
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

  // Track the translation ID that was used to initialize/reset the navigation
  const activeTranslationIdRef = useRef<number | undefined>(undefined)

  // Reset navigation when the primary translation changes
  // This ensures the navigation always shows content for the selected translation
  useEffect(() => {
    // Skip if no translation ID yet (query still loading)
    if (initialTranslationId === undefined) {
      return
    }

    // Skip if we're already using this translation
    if (activeTranslationIdRef.current === initialTranslationId) {
      return
    }

    // Translation changed (or first time we have a valid ID) - reset to books view
    activeTranslationIdRef.current = initialTranslationId
    setState({
      ...initialState,
      translationId: initialTranslationId,
    })
  }, [initialTranslationId])

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
      // Clear searchedIndex so selection matches presented verse
      searchedIndex: null,
    }))
  }, [])

  /** Sets the searched index (verse highlighted but not presented) */
  const setSearchedIndex = useCallback((index: number | null) => {
    setState((prev) => ({
      ...prev,
      searchedIndex: index,
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
      // Keep verse selected (indigo) so user can navigate with arrows and re-present with Enter
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

  /** Navigate to chapter (used by reference search and verse navigation) */
  const navigateToChapter = useCallback((params: NavigateToChapterParams) => {
    const isSearchNavigation = params.clearSearch === false
    const selectOnly = params.selectOnly === true
    setState((prev) => ({
      ...prev,
      bookId: params.bookId,
      bookName: params.bookName,
      chapter: params.chapter,
      // selectOnly: set searchedIndex (select without presenting), clear search
      // isSearchNavigation: set searchedIndex, keep search query
      // default: set presentedIndex (present), clear search
      presentedIndex:
        selectOnly || isSearchNavigation
          ? prev.presentedIndex
          : (params.verseIndex ?? null),
      searchedIndex:
        selectOnly || isSearchNavigation ? (params.verseIndex ?? null) : null,
      searchQuery: selectOnly ? '' : isSearchNavigation ? prev.searchQuery : '',
      level: 'verses',
    }))
  }, [])

  return {
    state,
    selectTranslation,
    selectBook,
    selectChapter,
    presentVerse,
    setSearchedIndex,
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
