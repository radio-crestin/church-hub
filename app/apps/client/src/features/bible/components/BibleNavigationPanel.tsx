import { Search, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppShortcuts } from '~/features/keyboard-shortcuts'
import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { BooksList } from './BooksList'
import { ChaptersGrid } from './ChaptersGrid'
import { VersesList } from './VersesList'
import {
  useAIBibleSearch,
  useBibleAISearchSettings,
  useBooks,
  useChapters,
  useLocalizedBookNames,
  useSearchBible,
  useSelectedBibleTranslations,
  useSmartSearch,
  useVerses,
} from '../hooks'
import type { UseBibleNavigationReturn } from '../hooks/useBibleNavigation'
import type {
  AIBibleSearchResult,
  BibleSearchResult,
  BibleVerse,
} from '../types'

const SEARCH_DEBOUNCE_MS = 600

interface BibleNavigationPanelProps {
  navigation: UseBibleNavigationReturn
  onSelectVerse: (verse: BibleVerse, index: number) => void
  onSelectSearchResult: (result: BibleSearchResult) => void
  onPresentSearched?: () => void
  onNextVerse?: () => void
  onPreviousVerse?: () => void
  onGoBack?: () => void
  focusTrigger?: number
  // URL navigation callbacks
  onNavigateToBook?: (bookId: number, bookName: string) => void
  onNavigateToChapter?: (
    bookId: number,
    bookName: string,
    chapter: number,
  ) => void
  onSearchQueryChange?: (query: string) => void
}

export function BibleNavigationPanel({
  navigation,
  onSelectVerse,
  onSelectSearchResult,
  onPresentSearched,
  onNextVerse,
  onPreviousVerse,
  onGoBack,
  focusTrigger,
  onNavigateToBook,
  onNavigateToChapter,
  onSearchQueryChange,
}: BibleNavigationPanelProps) {
  const { t } = useTranslation('bible')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { getBookName } = useLocalizedBookNames()
  const {
    state,
    selectBook,
    selectChapter,
    goBack,
    setSearchQuery,
    clearSearch,
  } = navigation

  // Local state for immediate input feedback
  const [localQuery, setLocalQuery] = useState(state.searchQuery)
  // Track the last synced value from state to detect external changes
  const lastSyncedStateQueryRef = useRef(state.searchQuery)
  // Track whether the current localQuery came from user input (typing) vs external sync
  const isUserTypingRef = useRef(false)

  // Debounced query for text search API calls
  const { debouncedValue: debouncedQuery, isPending } = useDebouncedValue(
    localQuery,
    SEARCH_DEBOUNCE_MS,
  )

  // Sync local state when navigation searchQuery changes externally (e.g., from URL)
  // Only run when state.searchQuery changes, NOT when localQuery changes
  useEffect(() => {
    // Only sync if state changed from what we last synced (external change)
    if (state.searchQuery !== lastSyncedStateQueryRef.current) {
      lastSyncedStateQueryRef.current = state.searchQuery
      isUserTypingRef.current = false // Mark as external sync, not user typing
      setLocalQuery(state.searchQuery)
    }
  }, [state.searchQuery])

  // Handle user input - mark as user typing
  const handleQueryChange = useCallback((value: string) => {
    isUserTypingRef.current = true // Mark as user typing
    setLocalQuery(value)
  }, [])

  // Sync debounced query to URL (for URL-based navigation)
  // Only sync when user typed something (not when state was set externally from URL)
  useEffect(() => {
    // Only sync to URL when:
    // 1. Debounce completed (localQuery === debouncedQuery)
    // 2. This is from user typing (not external state sync)
    // 3. The debounced value differs from current state
    if (
      localQuery === debouncedQuery &&
      isUserTypingRef.current &&
      debouncedQuery !== state.searchQuery
    ) {
      // Update the ref so the external sync effect doesn't revert this change
      lastSyncedStateQueryRef.current = debouncedQuery
      if (onSearchQueryChange) {
        onSearchQueryChange(debouncedQuery)
      } else {
        setSearchQuery(debouncedQuery)
      }
    }
  }, [
    debouncedQuery,
    state.searchQuery,
    localQuery,
    setSearchQuery,
    onSearchQueryChange,
  ])

  // Use provided onGoBack or fallback to navigation's goBack
  const handleGoBack = onGoBack ?? goBack

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Focus search input when focusTrigger changes (from keyboard shortcut)
  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      searchInputRef.current?.focus()
    }
  }, [focusTrigger])

  const { primaryTranslation, selectedTranslations } =
    useSelectedBibleTranslations()

  // Always use the primary translation for all data fetching
  const translationId = primaryTranslation?.id

  const { data: books = [], isLoading: isLoadingBooks } =
    useBooks(translationId)
  const { data: chapters = [], isLoading: isLoadingChapters } = useChapters(
    state.bookId,
  )
  const { data: verses = [], isLoading: isLoadingVerses } = useVerses(
    state.bookId,
    state.chapter,
  )

  // Get the book code for the current book
  const currentBook = books.find((b) => b.id === state.bookId)
  const bookCode = currentBook?.bookCode || ''
  // Smart search uses local query for immediate reference detection (e.g., "John 3:16")
  const { isReferenceSearch } = useSmartSearch({
    searchQuery: localQuery,
    books,
    navigation,
    enabled: localQuery.length >= 2,
    onNavigateToBook,
    onNavigateToChapter: onNavigateToChapter
      ? (bookId, bookName, chapter, verse) => {
          onNavigateToChapter(bookId, bookName, chapter)
          if (verse !== undefined) {
            navigation.setSearchedIndex(verse - 1)
          }
        }
      : undefined,
  })

  // Text search uses debounced query for API calls
  const { data: searchResults, isLoading: isSearching } = useSearchBible(
    debouncedQuery,
    translationId,
    50,
    !isReferenceSearch, // Only run text search when it's not a reference search
  )

  // AI Search
  const { isEnabled: aiSearchAvailable } = useBibleAISearchSettings()
  const aiSearchMutation = useAIBibleSearch()

  // Get search shortcut for display
  const { shortcuts } = useAppShortcuts()
  const searchBibleShortcut = useMemo(() => {
    const action = shortcuts.actions.searchBible
    return action?.enabled && action.shortcuts.length > 0
      ? action.shortcuts[0]
      : undefined
  }, [shortcuts])
  const [aiSearchResults, setAiSearchResults] = useState<AIBibleSearchResult[]>(
    [],
  )
  const [isAISearchActive, setIsAISearchActive] = useState(false)
  // Track focused search result for keyboard navigation
  const [focusedResultIndex, setFocusedResultIndex] = useState<number>(-1)

  // Handle AI search button click
  const handleAISearch = useCallback(async () => {
    if (!localQuery.trim() || aiSearchMutation.isPending) return

    setIsAISearchActive(true)
    try {
      const response = await aiSearchMutation.mutateAsync({
        query: localQuery,
        translationId,
      })
      setAiSearchResults(response.results)
    } catch {
      setAiSearchResults([])
    }
  }, [localQuery, translationId, aiSearchMutation])

  // Clear AI results when query changes
  useEffect(() => {
    if (isAISearchActive) {
      setIsAISearchActive(false)
      setAiSearchResults([])
    }
  }, [localQuery])

  // Reset focused index when search results change
  useEffect(() => {
    setFocusedResultIndex(-1)
  }, [searchResults, aiSearchResults])

  const handleSelectVerse = (index: number) => {
    const verse = verses[index]
    if (verse) {
      onSelectVerse(verse, index)
    }
  }

  // Show text search results only when there's an active text search (not reference search)
  // Use localQuery for immediate feedback (shows "Searching..." during typing and on restore)
  const isTextSearchActive = localQuery.length >= 2 && !isReferenceSearch

  // Focus search input when returning to search results (e.g., after pressing Escape from verse view)
  // This tracks when we transition back to showing search results
  const wasShowingSearchResultsRef = useRef(false)
  useEffect(() => {
    const isShowingSearchResults = isTextSearchActive && state.level === 'books'
    // Focus when transitioning TO search results view
    if (isShowingSearchResults && !wasShowingSearchResultsRef.current) {
      searchInputRef.current?.focus()
    }
    wasShowingSearchResultsRef.current = isShowingSearchResults
  }, [isTextSearchActive, state.level])

  // Get the current search results for keyboard navigation
  const currentSearchResults = isAISearchActive
    ? aiSearchResults
    : searchResults?.results || []

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle search results navigation when results are visible
    if (isTextSearchActive && currentSearchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedResultIndex((prev) =>
          prev < currentSearchResults.length - 1 ? prev + 1 : prev,
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedResultIndex((prev) => (prev > 0 ? prev - 1 : prev))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        // If a result is focused, select it
        if (
          focusedResultIndex >= 0 &&
          focusedResultIndex < currentSearchResults.length
        ) {
          const result = currentSearchResults[
            focusedResultIndex
          ] as BibleSearchResult
          onSelectSearchResult(result)
        }
        return
      }
    }

    // Handle Enter to present when already at verse level (existing behavior)
    if (e.key === 'Enter' && onPresentSearched) {
      e.preventDefault()
      onPresentSearched()
      return
    }

    // Handle arrow keys for verse navigation when in verses view
    if (state.level !== 'verses' || verses.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onNextVerse?.()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onPreviousVerse?.()
    }
  }

  const showPendingIndicator = isPending && localQuery.length >= 2

  const handleClearSearch = () => {
    handleQueryChange('')
    clearSearch()
  }

  return (
    <div className="flex flex-col lg:h-full bg-white dark:bg-gray-800 lg:rounded-lg lg:border lg:border-gray-200 lg:dark:border-gray-700">
      <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={localQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('search.placeholder')}
              className={`w-full pl-9 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white placeholder-gray-400 ${
                searchBibleShortcut && !localQuery ? 'pr-20' : 'pr-9'
              }`}
            />
            {(showPendingIndicator || aiSearchMutation.isPending) && (
              <div className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1 right-9">
                {aiSearchMutation.isPending ? (
                  <>
                    <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                    <span className="text-xs text-indigo-500">
                      {t('search.aiProcessing')}
                    </span>
                  </>
                ) : (
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                )}
              </div>
            )}
            {localQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            ) : searchBibleShortcut ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <KeyboardShortcutBadge shortcut={searchBibleShortcut} />
              </div>
            ) : null}
          </div>
          {aiSearchAvailable && (
            <button
              type="button"
              onClick={handleAISearch}
              disabled={!localQuery.trim() || aiSearchMutation.isPending}
              className={`px-2 py-2 rounded-lg border transition-colors flex items-center ${
                isAISearchActive
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={t('search.aiSearchTooltip')}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="lg:flex-1 overflow-hidden lg:overflow-y-auto lg:scrollbar-thin p-3">
        {isAISearchActive && aiSearchResults.length > 0 ? (
          <SearchResults
            results={aiSearchResults}
            type="ai"
            isLoading={false}
            onSelectResult={onSelectSearchResult}
            getBookName={getBookName}
            focusedIndex={focusedResultIndex}
          />
        ) : isTextSearchActive ? (
          <SearchResults
            results={searchResults?.results || []}
            type={searchResults?.type || 'text'}
            isLoading={isSearching}
            onSelectResult={onSelectSearchResult}
            getBookName={getBookName}
            focusedIndex={focusedResultIndex}
          />
        ) : state.level === 'books' ? (
          <BooksList
            books={books}
            isLoading={isLoadingBooks}
            onSelectBook={(bookId, bookName) => {
              if (onNavigateToBook) {
                onNavigateToBook(bookId, bookName)
              } else {
                selectBook(bookId, bookName)
              }
            }}
          />
        ) : state.level === 'chapters' ? (
          <ChaptersGrid
            bookName={state.bookName || ''}
            chapters={chapters}
            isLoading={isLoadingChapters}
            onSelectChapter={(chapter) => {
              if (onNavigateToChapter && state.bookId && state.bookName) {
                onNavigateToChapter(state.bookId, state.bookName, chapter)
              } else {
                selectChapter(chapter)
              }
            }}
            onGoBack={handleGoBack}
          />
        ) : (
          <VersesList
            bookName={state.bookName || ''}
            bookCode={bookCode}
            chapter={state.chapter || 0}
            verses={verses}
            presentedIndex={state.presentedIndex}
            searchedIndex={state.searchedIndex}
            isLoading={isLoadingVerses}
            selectedTranslations={selectedTranslations}
            onSelectVerse={handleSelectVerse}
            onGoBack={handleGoBack}
          />
        )}
      </div>
    </div>
  )
}

interface SearchResultsProps {
  results: BibleVerse[] | BibleSearchResult[] | AIBibleSearchResult[]
  type: 'reference' | 'text' | 'ai'
  isLoading: boolean
  onSelectResult: (result: BibleSearchResult) => void
  getBookName: (bookCode: string) => string | undefined
  focusedIndex?: number
}

function SearchResults({
  results,
  type,
  isLoading,
  onSelectResult,
  getBookName,
  focusedIndex = -1,
}: SearchResultsProps) {
  const { t } = useTranslation('bible')
  const focusedRef = useRef<HTMLButtonElement>(null)

  // Scroll focused result into view
  useEffect(() => {
    if (focusedIndex >= 0 && focusedRef.current) {
      focusedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [focusedIndex])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        {t('search.searching')}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {t('search.noResults')}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {results.map((result, index) => {
        const isSearchResult = type === 'text' || type === 'ai'
        const searchResult = result as BibleSearchResult
        const aiResult = result as AIBibleSearchResult
        const verse = result as BibleVerse
        const isFocused = index === focusedIndex

        // Get localized book name, fall back to original book name
        const bookCode = isSearchResult ? searchResult.bookCode : verse.bookCode
        const localizedBookName =
          getBookName(bookCode) ||
          (isSearchResult ? searchResult.bookName : verse.bookName)

        // Format reference with localized book name
        const reference = isSearchResult
          ? `${localizedBookName} ${searchResult.chapter}:${searchResult.verse}`
          : `${localizedBookName} ${verse.chapter}:${verse.verse}`

        return (
          <button
            key={result.id}
            ref={isFocused ? focusedRef : undefined}
            type="button"
            onClick={() => onSelectResult(searchResult)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              isFocused
                ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {reference}
              </span>
              {type === 'ai' && aiResult.aiRelevanceScore !== undefined && (
                <span className="flex items-center gap-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-3 h-3" />
                  {aiResult.aiRelevanceScore}%
                </span>
              )}
            </div>
            <div
              className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2"
              dangerouslySetInnerHTML={{
                __html: isSearchResult
                  ? searchResult.highlightedText
                  : verse.text,
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
