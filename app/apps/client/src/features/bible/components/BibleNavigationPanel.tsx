import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { BooksList } from './BooksList'
import { ChaptersGrid } from './ChaptersGrid'
import { VersesList } from './VersesList'
import {
  useBooks,
  useChapters,
  useLocalizedBookNames,
  useSearchBible,
  useSelectedBibleTranslations,
  useSmartSearch,
  useVerses,
} from '../hooks'
import type { UseBibleNavigationReturn } from '../hooks/useBibleNavigation'
import type { BibleSearchResult, BibleVerse } from '../types'

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

  // Debounced query for text search API calls
  const { debouncedValue: debouncedQuery, isPending } = useDebouncedValue(
    localQuery,
    SEARCH_DEBOUNCE_MS,
  )

  // Sync local state when navigation searchQuery changes externally (e.g., clearSearch)
  useEffect(() => {
    setLocalQuery(state.searchQuery)
  }, [state.searchQuery])

  // Sync debounced query back to navigation state (for other consumers)
  useEffect(() => {
    if (debouncedQuery !== state.searchQuery) {
      setSearchQuery(debouncedQuery)
    }
  }, [debouncedQuery, state.searchQuery, setSearchQuery])

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
  })

  // Text search uses debounced query for API calls
  const { data: searchResults, isLoading: isSearching } = useSearchBible(
    debouncedQuery,
    translationId,
    50,
    !isReferenceSearch, // Only run text search when it's not a reference search
  )

  const handleSelectVerse = (index: number) => {
    const verse = verses[index]
    if (verse) {
      onSelectVerse(verse, index)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  // Show text search results only when there's an active text search (not reference search)
  // Use debouncedQuery to only show results after debounce completes
  const isTextSearchActive = debouncedQuery.length >= 2 && !isReferenceSearch
  const showPendingIndicator = isPending && localQuery.length >= 2

  const handleClearSearch = () => {
    setLocalQuery('')
    clearSearch()
  }

  return (
    <div className="flex flex-col lg:h-full bg-white dark:bg-gray-800 lg:rounded-lg lg:border lg:border-gray-200 lg:dark:border-gray-700">
      <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('search.placeholder')}
            className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white placeholder-gray-400"
          />
          {showPendingIndicator && (
            <div className="absolute right-9 top-1/2 -translate-y-1/2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            </div>
          )}
          {localQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="lg:flex-1 overflow-hidden lg:overflow-y-auto lg:scrollbar-thin p-3">
        {isTextSearchActive ? (
          <SearchResults
            results={searchResults?.results || []}
            type={searchResults?.type || 'text'}
            isLoading={isSearching}
            onSelectResult={onSelectSearchResult}
            getBookName={getBookName}
          />
        ) : state.level === 'books' ? (
          <BooksList
            books={books}
            isLoading={isLoadingBooks}
            onSelectBook={selectBook}
          />
        ) : state.level === 'chapters' ? (
          <ChaptersGrid
            bookName={state.bookName || ''}
            chapters={chapters}
            isLoading={isLoadingChapters}
            onSelectChapter={selectChapter}
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
  results: BibleVerse[] | BibleSearchResult[]
  type: 'reference' | 'text'
  isLoading: boolean
  onSelectResult: (result: BibleSearchResult) => void
  getBookName: (bookCode: string) => string | undefined
}

function SearchResults({
  results,
  type,
  isLoading,
  onSelectResult,
  getBookName,
}: SearchResultsProps) {
  const { t } = useTranslation('bible')

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
      {results.map((result) => {
        const isSearchResult = type === 'text'
        const searchResult = result as BibleSearchResult
        const verse = result as BibleVerse

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
            type="button"
            onClick={() => onSelectResult(searchResult)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-0.5">
              {reference}
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
