import { ArrowLeft, Loader2, LocateFixed } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { KeyboardShortcutBadge } from '~/ui/kbd'
import { MultiTranslationVerse } from './MultiTranslationVerse'
import { useLocalizedBookNames } from '../hooks'
import type { ChapterData } from '../hooks/useInfiniteChapters'
import { useMultiTranslationVerse } from '../hooks/useMultiTranslationVerse'
import type { BibleTranslation } from '../types'

interface VersesListProps {
  bookId: number
  bookName: string
  bookCode: string
  chapter: number
  chapters: ChapterData[]
  presentedIndex: number | null
  searchedIndex: number | null
  isLoading: boolean
  selectedTranslations: BibleTranslation[]
  onSelectVerse: (
    index: number,
    chapter?: number,
    bookId?: number,
    bookName?: string,
  ) => void
  onGoBack: () => void
  onLoadPrevious: () => void
  onLoadNext: () => void
  canLoadPrevious: boolean
  canLoadNext: boolean
  isLoadingPrevious: boolean
  isLoadingNext: boolean
}

export function VersesList({
  bookId,
  bookName,
  bookCode,
  chapter,
  chapters,
  presentedIndex,
  searchedIndex,
  isLoading,
  selectedTranslations,
  onSelectVerse,
  onGoBack,
  onLoadPrevious,
  onLoadNext,
  canLoadPrevious,
  canLoadNext,
  isLoadingPrevious,
  isLoadingNext,
}: VersesListProps) {
  const { t } = useTranslation('bible')
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  // Ref to the first verse of the current chapter (for scrolling when no verse is selected)
  const currentChapterFirstVerseRef = useRef<HTMLButtonElement>(null)
  // Track if infinite scroll observers should be active (requires user scroll)
  const [isInfiniteScrollReady, setIsInfiniteScrollReady] = useState(false)
  // Track the current chapter key to detect chapter changes
  const chapterKeyRef = useRef(`${bookId}-${chapter}`)
  // Track if user has scrolled (to enable infinite scroll)
  const hasUserScrolledRef = useRef(false)
  // Track previous chapters count for scroll position preservation
  const prevChaptersCountRef = useRef(chapters.length)
  const scrollPreservationRef = useRef<{
    scrollTop: number
    scrollHeight: number
  } | null>(null)
  const { getBookName } = useLocalizedBookNames()

  // Get the current chapter's verses for multi-translation lookup
  const currentChapterData = chapters.find(
    (ch) => ch.bookId === bookId && ch.chapter === chapter,
  )
  const currentVerses = currentChapterData?.verses || []

  // Get the presented verse number for multi-translation lookup
  const presentedVerseNumber =
    presentedIndex !== null ? currentVerses[presentedIndex]?.verse : undefined

  // Fetch the same verse from all other selected translations
  const otherTranslations = selectedTranslations.slice(1)
  const { results: multiTranslationResults, isLoading: isLoadingMulti } =
    useMultiTranslationVerse(
      otherTranslations,
      bookCode,
      chapter,
      presentedVerseNumber,
    )

  // Scroll to the highlighted verse
  const scrollTargetIndex = searchedIndex ?? presentedIndex
  const versesKey = currentVerses[0]?.id
  const currentChapterKey = `${bookId}-${chapter}`

  // Reset infinite scroll state when chapter changes
  useEffect(() => {
    if (chapterKeyRef.current !== currentChapterKey) {
      chapterKeyRef.current = currentChapterKey
      setIsInfiniteScrollReady(false)
      hasUserScrolledRef.current = false
      prevChaptersCountRef.current = chapters.length
      scrollPreservationRef.current = null
    }
  }, [currentChapterKey, chapters.length])

  // Preserve scroll position when previous chapters are loaded
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const currentCount = chapters.length
    const prevCount = prevChaptersCountRef.current

    // Check if new chapters were prepended (count increased and we have preserved scroll data)
    if (currentCount > prevCount && scrollPreservationRef.current) {
      const { scrollTop, scrollHeight: prevScrollHeight } =
        scrollPreservationRef.current
      const newScrollHeight = container.scrollHeight
      const heightDiff = newScrollHeight - prevScrollHeight

      // Adjust scroll position to maintain visual position
      container.scrollTop = scrollTop + heightDiff
      scrollPreservationRef.current = null
    }

    prevChaptersCountRef.current = currentCount
  }, [chapters.length])

  // Listen for user scroll to enable infinite scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (!hasUserScrolledRef.current) {
        hasUserScrolledRef.current = true
        // Small delay to ensure scroll position is stable
        setTimeout(() => {
          setIsInfiniteScrollReady(true)
        }, 100)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to highlighted verse or first verse of current chapter on initial render
  useEffect(() => {
    // Use instant scroll (no animation) to avoid triggering observers
    const scrollToTarget = () => {
      if (!containerRef.current) return

      if (scrollTargetIndex !== null && highlightedRef.current) {
        // Scroll to highlighted verse centered in view
        highlightedRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'center',
        })
      } else if (currentChapterFirstVerseRef.current) {
        // No verse selected - scroll to show sticky header and first verse at top
        // Scroll to the parent chapter container to align sticky header at top
        const verseElement = currentChapterFirstVerseRef.current
        const chapterContainer = verseElement.closest('.mb-4')
        if (chapterContainer) {
          chapterContainer.scrollIntoView({
            behavior: 'auto',
            block: 'start',
          })
        }
      }
    }

    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToTarget)
    })

    return () => cancelAnimationFrame(rafId)
  }, [scrollTargetIndex, versesKey])

  // IntersectionObserver for infinite scroll - load previous chapters
  useEffect(() => {
    // Don't set up observers until initial render is complete
    if (!isInfiniteScrollReady) return
    if (!topSentinelRef.current || !containerRef.current) return

    const container = containerRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          canLoadPrevious &&
          !isLoadingPrevious
        ) {
          // Save scroll position before loading previous chapters
          scrollPreservationRef.current = {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
          }
          onLoadPrevious()
        }
      },
      {
        root: container,
        rootMargin: '100px 0px 0px 0px',
        threshold: 0,
      },
    )

    observer.observe(topSentinelRef.current)
    return () => observer.disconnect()
  }, [
    isInfiniteScrollReady,
    canLoadPrevious,
    isLoadingPrevious,
    onLoadPrevious,
  ])

  // IntersectionObserver for infinite scroll - load next chapters
  useEffect(() => {
    // Don't set up observers until initial render is complete
    if (!isInfiniteScrollReady) return
    if (!bottomSentinelRef.current || !containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && canLoadNext && !isLoadingNext) {
          onLoadNext()
        }
      },
      {
        root: containerRef.current,
        rootMargin: '0px 0px 100px 0px',
        threshold: 0,
      },
    )

    observer.observe(bottomSentinelRef.current)
    return () => observer.disconnect()
  }, [isInfiniteScrollReady, canLoadNext, isLoadingNext, onLoadNext])

  const handleVerseClick = useCallback(
    (
      verseIndex: number,
      chapterNum: number,
      verseBookId: number,
      verseBookName: string,
    ) => {
      if (chapterNum === chapter && verseBookId === bookId) {
        onSelectVerse(verseIndex)
      } else {
        onSelectVerse(verseIndex, chapterNum, verseBookId, verseBookName)
      }
    },
    [chapter, bookId, onSelectVerse],
  )

  if (isLoading && chapters.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onGoBack}
          className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('navigation.back')}
          <KeyboardShortcutBadge shortcut="Escape" variant="muted" />
        </button>
        {presentedIndex !== null && (
          <button
            type="button"
            onClick={() => {
              highlightedRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              })
            }}
            className="p-1.5 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            title={t('navigation.scrollToVerse')}
          >
            <LocateFixed size={16} />
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto px-0.5 py-0.5"
      >
        {/* Top sentinel for loading previous chapters */}
        <div
          ref={topSentinelRef}
          className="h-8 flex items-center justify-center"
        >
          {isLoadingPrevious && (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>

        {chapters.map((chapterData) => {
          const groupLocalizedBookName =
            getBookName(chapterData.bookCode) || chapterData.bookName
          const label = `${groupLocalizedBookName} ${chapterData.chapter}`
          const isCurrentChapter =
            chapterData.bookId === bookId && chapterData.chapter === chapter

          if (chapterData.isLoading) {
            return (
              <div
                key={`${chapterData.bookId}-${chapterData.chapter}`}
                className="mb-4"
              >
                <div className="sticky -top-0.5 z-10 px-3 py-1 bg-white dark:bg-gray-800">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {label}
                  </span>
                </div>
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              </div>
            )
          }

          return (
            <div
              key={`${chapterData.bookId}-${chapterData.chapter}`}
              className="mb-4"
            >
              {/* Sticky chapter label */}
              <div className="sticky -top-0.5 z-10 px-3 py-1 bg-white dark:bg-gray-800">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {label}
                </span>
              </div>

              <div className="space-y-1">
                {chapterData.verses.map((verse, verseIndex) => {
                  const isPresented =
                    isCurrentChapter && verseIndex === presentedIndex
                  const isSearched =
                    isCurrentChapter &&
                    verseIndex === searchedIndex &&
                    !isPresented
                  const isHighlighted = isPresented || isSearched

                  const getButtonClass = () => {
                    if (isPresented) {
                      return 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
                    }
                    if (isSearched) {
                      return 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500'
                    }
                    return 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }

                  const getVerseNumberClass = () => {
                    if (isPresented) {
                      return 'text-green-700 dark:text-green-300'
                    }
                    if (isSearched) {
                      return 'text-indigo-700 dark:text-indigo-300'
                    }
                    return 'text-gray-500 dark:text-gray-400'
                  }

                  const getTextClass = () => {
                    if (isPresented) {
                      return 'text-green-900 dark:text-green-100'
                    }
                    if (isSearched) {
                      return 'text-indigo-900 dark:text-indigo-100'
                    }
                    return 'text-gray-700 dark:text-gray-200'
                  }

                  // Track first verse of current chapter for scroll targeting
                  const isFirstVerseOfCurrentChapter =
                    isCurrentChapter && verseIndex === 0

                  // Determine which ref to use
                  const getButtonRef = () => {
                    if (isHighlighted) return highlightedRef
                    if (isFirstVerseOfCurrentChapter)
                      return currentChapterFirstVerseRef
                    return null
                  }

                  return (
                    <div key={verse.id}>
                      <button
                        ref={getButtonRef()}
                        type="button"
                        tabIndex={-1}
                        onClick={() =>
                          handleVerseClick(
                            verseIndex,
                            chapterData.chapter,
                            chapterData.bookId,
                            chapterData.bookName,
                          )
                        }
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${getButtonClass()}`}
                      >
                        <span
                          className={`font-semibold mr-2 ${getVerseNumberClass()}`}
                        >
                          {verse.verse}
                        </span>
                        <span className={getTextClass()}>{verse.text}</span>
                      </button>
                      {isPresented && otherTranslations.length > 0 && (
                        <MultiTranslationVerse
                          results={multiTranslationResults}
                          isLoading={isLoadingMulti}
                          verseNumber={verse.verse}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Bottom sentinel for loading next chapters */}
        <div
          ref={bottomSentinelRef}
          className="h-8 flex items-center justify-center"
        >
          {isLoadingNext && (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>
      </div>
    </div>
  )
}
