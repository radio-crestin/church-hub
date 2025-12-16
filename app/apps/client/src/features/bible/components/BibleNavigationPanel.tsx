import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BooksList } from './BooksList'
import { ChaptersGrid } from './ChaptersGrid'
import { TranslationSelector } from './TranslationSelector'
import { VersesList } from './VersesList'
import { useBooks, useChapters, useSearchBible, useVerses } from '../hooks'
import type { UseBibleNavigationReturn } from '../hooks/useBibleNavigation'
import type { BibleSearchResult, BibleVerse } from '../types'

interface BibleNavigationPanelProps {
  navigation: UseBibleNavigationReturn
  translations: { id: number; name: string; abbreviation: string }[]
  isLoadingTranslations: boolean
  onSelectVerse: (verse: BibleVerse, index: number) => void
  onSelectSearchResult: (result: BibleSearchResult) => void
}

export function BibleNavigationPanel({
  navigation,
  translations,
  isLoadingTranslations,
  onSelectVerse,
  onSelectSearchResult,
}: BibleNavigationPanelProps) {
  const { t } = useTranslation('bible')
  const {
    state,
    selectTranslation,
    selectBook,
    selectChapter,
    selectVerse,
    goBack,
    setSearchQuery,
    clearSearch,
  } = navigation

  const { data: books = [], isLoading: isLoadingBooks } = useBooks(
    state.translationId,
  )
  const { data: chapters = [], isLoading: isLoadingChapters } = useChapters(
    state.bookId,
  )
  const { data: verses = [], isLoading: isLoadingVerses } = useVerses(
    state.bookId,
    state.chapter,
  )
  const { data: searchResults, isLoading: isSearching } = useSearchBible(
    state.searchQuery,
    state.translationId,
  )

  const handleSelectVerse = (index: number) => {
    selectVerse(index)
    const verse = verses[index]
    if (verse) {
      onSelectVerse(verse, index)
    }
  }

  const isSearchActive = state.searchQuery.length >= 2

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={state.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white placeholder-gray-400"
          />
          {state.searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <TranslationSelector
          translations={translations}
          selectedId={state.translationId}
          onSelect={selectTranslation}
          isLoading={isLoadingTranslations}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isSearchActive ? (
          <SearchResults
            results={searchResults?.results || []}
            type={searchResults?.type || 'text'}
            isLoading={isSearching}
            onSelectResult={onSelectSearchResult}
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
            onGoBack={goBack}
          />
        ) : (
          <VersesList
            bookName={state.bookName || ''}
            chapter={state.chapter || 0}
            verses={verses}
            selectedIndex={state.verseIndex}
            isLoading={isLoadingVerses}
            onSelectVerse={handleSelectVerse}
            onGoBack={goBack}
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
}

function SearchResults({
  results,
  type,
  isLoading,
  onSelectResult,
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

        return (
          <button
            key={result.id}
            type="button"
            onClick={() => onSelectResult(searchResult)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-0.5">
              {isSearchResult
                ? searchResult.reference
                : `${verse.bookName} ${verse.chapter}:${verse.verse}`}
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
