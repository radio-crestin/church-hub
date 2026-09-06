import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  LocateFixed,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { KeyboardShortcutBadge } from '~/ui/kbd'
import { MultiTranslationVerse } from './MultiTranslationVerse'
import { useLocalizedBookNames } from '../hooks'
import type { ChapterData } from '../hooks/useInfiniteChapters'
import { useMultiTranslationVerse } from '../hooks/useMultiTranslationVerse'
import type { BibleTranslation } from '../types'

interface VersesListProps {
  bookId: number
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
  // Track whether the user has taken manual control of the scroll position.
  // While true, the auto-scroll below stands down so it never fights an
  // in-progress gesture. Picking a new target hands control back to it.
  const userTookOverScrollRef = useRef(false)
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

  // Hand scroll ownership to the user on any genuine input gesture. We listen
  // for input events rather than 'scroll' because a scroll event is emitted
  // identically for our own scrollTop writes below, so it cannot tell a user
  // gesture apart from the auto-scroll's own output. 'touchmove' (not
  // 'touchstart') and 'pointerdown' keep taps on a verse from counting as
  // scroll intent while still catching drags of the scrollbar.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const takeOverScroll = () => {
      userTookOverScrollRef.current = true
    }

    const gestures = ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const
    for (const gesture of gestures) {
      container.addEventListener(gesture, takeOverScroll, { passive: true })
    }
    return () => {
      for (const gesture of gestures) {
        container.removeEventListener(gesture, takeOverScroll)
      }
    }
  }, [])

  // Scroll to highlighted verse or first verse of current chapter. Runs as a
  // layout effect so the scroll happens synchronously before paint, then keeps
  // retrying for ~5s to survive the case where the new chapter's verses arrive
  // after the first attempt (chapter cross can re-mount the highlighted button
  // multiple times as the infinite-scroll window updates).
  useLayoutEffect(() => {
    // A genuinely new target (verse selected, chapter crossed, verses arrived)
    // means the auto-scroll owns the scroll position again, even if the user
    // had scrolled away from the previous target.
    userTookOverScrollRef.current = false

    const rafIds: number[] = []
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const isInView = (el: HTMLElement) => {
      const container = containerRef.current
      if (!container) return false
      const c = container.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return r.top >= c.top - 1 && r.bottom <= c.bottom + 1
    }

    // Compute and set scrollTop directly using bounding rects. scrollIntoView()
    // can silently no-op when the verse list re-mounts mid-chapter-cross, and
    // offsetTop math fails when an intermediate ancestor (e.g., a chapter
    // wrapper) is positioned and breaks the offsetParent chain.
    const scrollElementToCenter = (el: HTMLElement) => {
      const container = containerRef.current
      if (!container) return
      const cRect = container.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      const delta = eRect.top - cRect.top - cRect.height / 2 + eRect.height / 2
      container.scrollTop += delta
    }

    const scrollElementToStart = (el: HTMLElement) => {
      const container = containerRef.current
      if (!container) return
      const cRect = container.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      container.scrollTop += eRect.top - cRect.top
    }

    const scrollToTarget = () => {
      if (cancelled || !containerRef.current) return false

      if (scrollTargetIndex !== null && highlightedRef.current) {
        scrollElementToCenter(highlightedRef.current)
        return isInView(highlightedRef.current)
      }
      if (currentChapterFirstVerseRef.current) {
        const verseElement = currentChapterFirstVerseRef.current
        const chapterContainer = verseElement.closest(
          '[data-chapter-group]',
        ) as HTMLElement | null
        if (chapterContainer) {
          scrollElementToStart(chapterContainer)
          return isInView(verseElement)
        }
      }
      return false
    }

    // Scroll on every attempt for the full window. We can't stop early on
    // isInView because subsequent layout shifts (a sibling chapter finishing
    // its query) can push the verse off-screen again after we declared
    // success. Total budget ~3s, scrolling roughly every 150ms. The user
    // taking over is the one condition that ends the window early — otherwise
    // every remaining attempt yanks the list back mid-gesture.
    const scheduleAttempt = (attemptsLeft: number, delayMs: number) => {
      const raf = requestAnimationFrame(() => {
        if (cancelled || userTookOverScrollRef.current) return
        scrollToTarget()
        if (attemptsLeft <= 0) return
        timeoutId = setTimeout(
          () => scheduleAttempt(attemptsLeft - 1, delayMs),
          delayMs,
        )
      })
      rafIds.push(raf)
    }

    rafIds.push(requestAnimationFrame(() => scheduleAttempt(20, 150)))

    return () => {
      cancelled = true
      for (const id of rafIds) cancelAnimationFrame(id)
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
    // `chapters` is deliberately not a dependency: useQueries hands back a new
    // array reference on nearly every render (including the re-render the
    // scroll listener above causes), which restarted this ~3s re-centering
    // window mid-scroll and warped the list back to the selected verse.
    // versesKey and currentChapterKey already cover every change to the
    // current chapter's own verses; a sibling chapter's late layout shift is
    // handled by the retry window rather than by re-running the effect.
  }, [scrollTargetIndex, versesKey, currentChapterKey])

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
        data-testid="bible-verses-scroll"
        className="flex-1 min-h-0 overflow-y-auto lg:scrollbar-thin px-1 pb-1"
      >
        {/* Mobile: load previous button */}
        {canLoadPrevious && (
          <button
            type="button"
            onClick={onLoadPrevious}
            disabled={isLoadingPrevious}
            className="w-full flex items-center justify-center gap-2 py-2 mb-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors lg:hidden disabled:opacity-50"
          >
            {isLoadingPrevious ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronUp size={16} />
            )}
            {t('navigation.loadPrevious')}
          </button>
        )}
        {/* Desktop: invisible sentinel for infinite scroll */}
        <div
          ref={topSentinelRef}
          className="hidden lg:flex h-8 items-center justify-center"
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
                data-chapter-group
                className="pb-4"
              >
                <div className="sticky top-0 z-10 -mx-1 px-4 py-1.5 bg-white dark:bg-gray-800">
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
              data-chapter-group
              className="pb-4"
            >
              {/* Sticky chapter label */}
              <div className="sticky top-0 z-10 -mx-1 px-4 py-1.5 bg-white dark:bg-gray-800">
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
                      return 'bg-green-100 dark:bg-green-900/50 ring-2 ring-inset ring-green-500'
                    }
                    if (isSearched) {
                      return 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-inset ring-indigo-500'
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
                        data-verse={verse.verse}
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

        {/* Desktop: invisible sentinel for infinite scroll */}
        <div
          ref={bottomSentinelRef}
          className="hidden lg:flex h-8 items-center justify-center"
        >
          {isLoadingNext && (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>
        {/* Mobile: load next button */}
        {canLoadNext && (
          <button
            type="button"
            onClick={onLoadNext}
            disabled={isLoadingNext}
            className="w-full flex items-center justify-center gap-2 py-2 mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors lg:hidden disabled:opacity-50"
          >
            {isLoadingNext ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronDown size={16} />
            )}
            {t('navigation.loadNext')}
          </button>
        )}
      </div>
    </div>
  )
}
