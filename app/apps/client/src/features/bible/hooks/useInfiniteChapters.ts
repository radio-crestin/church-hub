import { useQueries } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { getVerses } from '../service'
import type { BibleBook, BibleVerse } from '../types'

export interface ChapterData {
  bookId: number
  bookName: string
  bookCode: string
  chapter: number
  verses: BibleVerse[]
  isLoading: boolean
}

interface UseInfiniteChaptersProps {
  books: BibleBook[]
  currentBookId: number | undefined
  currentChapter: number | undefined
  enabled: boolean
}

interface UseInfiniteChaptersReturn {
  chapters: ChapterData[]
  isLoading: boolean
  loadPrevious: () => void
  loadNext: () => void
  canLoadPrevious: boolean
  canLoadNext: boolean
  isLoadingPrevious: boolean
  isLoadingNext: boolean
}

interface ChapterRef {
  bookId: number
  bookIndex: number
  chapter: number
}

/**
 * Hook for infinite scroll through Bible chapters
 * Manages loading chapters before and after the current position
 */
export function useInfiniteChapters({
  books,
  currentBookId,
  currentChapter,
  enabled,
}: UseInfiniteChaptersProps): UseInfiniteChaptersReturn {
  // Track the range of chapters to load relative to current position
  const [loadedRange, setLoadedRange] = useState({ before: 1, after: 1 })

  // Reset range when current chapter changes
  useEffect(() => {
    setLoadedRange({ before: 1, after: 1 })
  }, [currentBookId, currentChapter])

  // Get current book info
  const currentBookIndex = useMemo(
    () => books.findIndex((b) => b.id === currentBookId),
    [books, currentBookId],
  )
  const currentBook =
    currentBookIndex >= 0 ? books[currentBookIndex] : undefined

  // Calculate all chapter references to fetch
  const chapterRefs = useMemo((): ChapterRef[] => {
    if (!enabled || !currentBook || !currentChapter) return []

    const refs: ChapterRef[] = []

    // Calculate chapters before current
    let remainingBefore = loadedRange.before
    let bookIdx = currentBookIndex
    let ch = currentChapter - 1

    while (remainingBefore > 0 && bookIdx >= 0) {
      if (ch >= 1) {
        refs.unshift({
          bookId: books[bookIdx].id,
          bookIndex: bookIdx,
          chapter: ch,
        })
        remainingBefore--
        ch--
      } else {
        // Move to previous book's last chapter
        bookIdx--
        if (bookIdx >= 0) {
          ch = books[bookIdx].chapterCount
        }
      }
    }

    // Add current chapter
    refs.push({
      bookId: currentBook.id,
      bookIndex: currentBookIndex,
      chapter: currentChapter,
    })

    // Calculate chapters after current
    let remainingAfter = loadedRange.after
    bookIdx = currentBookIndex
    ch = currentChapter + 1

    while (remainingAfter > 0 && bookIdx < books.length) {
      const book = books[bookIdx]
      if (ch <= book.chapterCount) {
        refs.push({
          bookId: book.id,
          bookIndex: bookIdx,
          chapter: ch,
        })
        remainingAfter--
        ch++
      } else {
        // Move to next book's first chapter
        bookIdx++
        ch = 1
      }
    }

    return refs
  }, [
    books,
    currentBook,
    currentBookIndex,
    currentChapter,
    loadedRange,
    enabled,
  ])

  // Fetch all chapters in the range
  const queries = useQueries({
    queries: chapterRefs.map((ref) => ({
      queryKey: ['bible', 'verses', ref.bookId, ref.chapter],
      queryFn: () => getVerses(ref.bookId, ref.chapter),
      enabled: enabled && !!ref.bookId && !!ref.chapter,
      staleTime: 10 * 60 * 1000,
    })),
  })

  // Combine query results with chapter info
  const chapters = useMemo((): ChapterData[] => {
    return chapterRefs.map((ref, index) => {
      const book = books[ref.bookIndex]
      const query = queries[index]
      return {
        bookId: ref.bookId,
        bookName: book?.bookName || '',
        bookCode: book?.bookCode || '',
        chapter: ref.chapter,
        verses: query?.data || [],
        isLoading: query?.isLoading || false,
      }
    })
  }, [chapterRefs, queries, books])

  // Check if we can load more
  const canLoadPrevious = useMemo(() => {
    if (chapterRefs.length === 0) return false
    const first = chapterRefs[0]
    // Can load more if not at Genesis 1
    return first.bookIndex > 0 || first.chapter > 1
  }, [chapterRefs])

  const canLoadNext = useMemo(() => {
    if (chapterRefs.length === 0) return false
    const last = chapterRefs[chapterRefs.length - 1]
    const lastBook = books[last.bookIndex]
    // Can load more if not at last chapter of last book
    return (
      last.bookIndex < books.length - 1 || last.chapter < lastBook?.chapterCount
    )
  }, [chapterRefs, books])

  // Loading states for edges
  const isLoadingPrevious = queries[0]?.isLoading || false
  const isLoadingNext = queries[queries.length - 1]?.isLoading || false

  // Load more chapters
  const loadPrevious = useCallback(() => {
    if (canLoadPrevious) {
      setLoadedRange((prev) => ({ ...prev, before: prev.before + 2 }))
    }
  }, [canLoadPrevious])

  const loadNext = useCallback(() => {
    if (canLoadNext) {
      setLoadedRange((prev) => ({ ...prev, after: prev.after + 2 }))
    }
  }, [canLoadNext])

  const isLoading = queries.some((q) => q.isLoading)

  return {
    chapters,
    isLoading,
    loadPrevious,
    loadNext,
    canLoadPrevious,
    canLoadNext,
    isLoadingPrevious,
    isLoadingNext,
  }
}
