import { Book, Loader2, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TranslationSelector } from './TranslationSelector'
import { VerseCard } from './VerseCard'
import { useSearchBible, useTranslations } from '../hooks'
import type { BibleSearchResult, BibleVerse } from '../types'

interface BibleSearchProps {
  onPresentNow?: (verse: BibleVerse | BibleSearchResult) => void
  onAddToQueue?: (verse: BibleVerse | BibleSearchResult) => void
}

export function BibleSearch({ onPresentNow, onAddToQueue }: BibleSearchProps) {
  const { t } = useTranslation('bible')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedTranslationId, setSelectedTranslationId] = useState<
    number | undefined
  >()

  const { data: translations, isLoading: translationsLoading } =
    useTranslations()
  const { data: searchResults, isLoading: searchLoading } = useSearchBible(
    query,
    selectedTranslationId,
  )

  // Auto-select first translation
  useEffect(() => {
    if (translations && translations.length > 0 && !selectedTranslationId) {
      setSelectedTranslationId(translations[0].id)
    }
  }, [translations, selectedTranslationId])

  // Auto-focus search input
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const selectedTranslation = translations?.find(
    (t) => t.id === selectedTranslationId,
  )

  const hasResults = searchResults && searchResults.results.length > 0
  const isSearching = query.length >= 2

  return (
    <div className="space-y-4">
      {/* Header with translation selector */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Book className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('title')}
          </h2>
        </div>
        <TranslationSelector
          translations={translations || []}
          selectedId={selectedTranslationId}
          onSelect={setSelectedTranslationId}
          isLoading={translationsLoading}
        />
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Results */}
      <div className="space-y-2">
        {searchLoading && isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        )}

        {!searchLoading && isSearching && !hasResults && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {t('search.noResults', { query })}
          </div>
        )}

        {!isSearching && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Book className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('search.hint')}</p>
          </div>
        )}

        {hasResults && (
          <>
            {searchResults.type === 'reference' && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {t('search.directReference')}
              </div>
            )}
            {searchResults.type === 'text' && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {t('search.resultsCount', {
                  count: searchResults.results.length,
                })}
              </div>
            )}
            <div className="space-y-2">
              {searchResults.results.map((result) => (
                <VerseCard
                  key={result.id}
                  verse={result}
                  translationAbbreviation={selectedTranslation?.abbreviation}
                  onPresentNow={onPresentNow}
                  onAddToQueue={onAddToQueue}
                  highlightedText={
                    'highlightedText' in result
                      ? result.highlightedText
                      : undefined
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
