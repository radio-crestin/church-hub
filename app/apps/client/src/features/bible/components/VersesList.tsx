import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { MultiTranslationVerse } from './MultiTranslationVerse'
import { useLocalizedBookNames } from '../hooks'
import { useMultiTranslationVerse } from '../hooks/useMultiTranslationVerse'
import type { BibleTranslation, BibleVerse } from '../types'

interface VersesListProps {
  bookName: string
  bookCode: string
  chapter: number
  verses: BibleVerse[]
  presentedIndex: number | null
  searchedIndex: number | null
  isLoading: boolean
  selectedTranslations: BibleTranslation[]
  onSelectVerse: (index: number) => void
  onGoBack: () => void
}

export function VersesList({
  bookName,
  bookCode,
  chapter,
  verses,
  presentedIndex,
  searchedIndex,
  isLoading,
  selectedTranslations,
  onSelectVerse,
  onGoBack,
}: VersesListProps) {
  const { t } = useTranslation('bible')
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { getBookName } = useLocalizedBookNames()

  // Use localized book name if available, otherwise fall back to the passed bookName
  const localizedBookName = getBookName(bookCode) || bookName

  // Get the presented verse number for multi-translation lookup
  const presentedVerseNumber =
    presentedIndex !== null ? verses[presentedIndex]?.verse : undefined

  // Fetch the same verse from all other selected translations
  // Skip the primary translation (first one) as it's already shown
  const otherTranslations = selectedTranslations.slice(1)
  const { results: multiTranslationResults, isLoading: isLoadingMulti } =
    useMultiTranslationVerse(
      otherTranslations,
      bookCode,
      chapter,
      presentedVerseNumber,
    )

  // Scroll to the highlighted verse (prioritize searched for navigation, then presented)
  const scrollTargetIndex = searchedIndex ?? presentedIndex

  // Use first verse ID as a stable key to detect when verse content changes
  const versesKey = verses[0]?.id

  useEffect(() => {
    // Skip if no target to scroll to
    if (scrollTargetIndex === null) return

    // Use requestAnimationFrame to ensure DOM is fully painted before scrolling
    const scrollToHighlighted = () => {
      if (highlightedRef.current && containerRef.current) {
        highlightedRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }

    // Double RAF ensures the scroll happens after React has committed DOM changes
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToHighlighted)
    })

    return () => cancelAnimationFrame(rafId)
  }, [scrollTargetIndex, versesKey])

  if (isLoading) {
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
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {localizedBookName} {chapter}
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-0 space-y-1 overflow-y-auto px-0.5 py-0.5"
      >
        {verses.map((verse, index) => {
          const isPresented = index === presentedIndex
          const isSearched = index === searchedIndex && !isPresented
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

          return (
            <div key={verse.id}>
              <button
                ref={isHighlighted ? highlightedRef : null}
                type="button"
                tabIndex={-1}
                onClick={() => onSelectVerse(index)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${getButtonClass()}`}
              >
                <span className={`font-semibold mr-2 ${getVerseNumberClass()}`}>
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
}
