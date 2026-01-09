import { useEffect, useMemo, useRef } from 'react'

import type { UseBibleNavigationReturn } from './useBibleNavigation'
import type { BibleBook } from '../types'
import { parseReference } from '../utils/parseReference'

interface UseSmartSearchParams {
  searchQuery: string
  books: BibleBook[]
  navigation: UseBibleNavigationReturn
  enabled: boolean
  // URL navigation callbacks (optional)
  onNavigateToBook?: (bookId: number, bookName: string) => void
  onNavigateToChapter?: (
    bookId: number,
    bookName: string,
    chapter: number,
    verse?: number,
  ) => void
}

export function useSmartSearch({
  searchQuery,
  books,
  navigation,
  enabled,
  onNavigateToBook,
  onNavigateToChapter,
}: UseSmartSearchParams) {
  const lastNavigatedRef = useRef<string | null>(null)
  const { selectBook, navigateToChapter, selectVerse } = navigation

  const parsedReference = useMemo(() => {
    if (!enabled || books.length === 0 || !searchQuery.trim()) {
      return null
    }
    return parseReference(searchQuery, books)
  }, [searchQuery, books, enabled])

  useEffect(() => {
    if (!parsedReference || parsedReference.type === 'none') {
      lastNavigatedRef.current = null
      return
    }

    const { matchedBook, chapter, verse, type } = parsedReference
    if (!matchedBook) return

    const navigationKey = `${type}-${matchedBook.id}-${chapter ?? ''}-${verse ?? ''}`
    if (lastNavigatedRef.current === navigationKey) {
      return
    }

    lastNavigatedRef.current = navigationKey

    switch (type) {
      case 'book':
        if (onNavigateToBook) {
          onNavigateToBook(matchedBook.id, matchedBook.bookName)
        } else {
          selectBook(matchedBook.id, matchedBook.bookName, false)
        }
        break
      case 'chapter':
        if (chapter !== undefined) {
          if (onNavigateToChapter) {
            onNavigateToChapter(matchedBook.id, matchedBook.bookName, chapter)
          } else {
            navigateToChapter({
              bookId: matchedBook.id,
              bookName: matchedBook.bookName,
              chapter,
              clearSearch: false,
            })
          }
        }
        break
      case 'verse':
        if (chapter !== undefined && verse !== undefined) {
          if (onNavigateToChapter) {
            onNavigateToChapter(
              matchedBook.id,
              matchedBook.bookName,
              chapter,
              verse,
            )
          } else {
            navigateToChapter({
              bookId: matchedBook.id,
              bookName: matchedBook.bookName,
              chapter,
              verseIndex: verse - 1, // Convert to 0-based index
              clearSearch: false,
            })
          }
        }
        break
    }
  }, [
    parsedReference,
    selectBook,
    navigateToChapter,
    selectVerse,
    onNavigateToBook,
    onNavigateToChapter,
  ])

  return {
    parsedReference,
    isReferenceSearch:
      parsedReference !== null && parsedReference.type !== 'none',
  }
}
