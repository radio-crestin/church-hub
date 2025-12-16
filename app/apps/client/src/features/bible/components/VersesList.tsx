import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { BibleVerse } from '../types'

interface VersesListProps {
  bookName: string
  chapter: number
  verses: BibleVerse[]
  selectedIndex: number
  presentedIndex: number | null
  isLoading: boolean
  onSelectVerse: (index: number) => void
  onGoBack: () => void
}

export function VersesList({
  bookName,
  chapter,
  verses,
  selectedIndex,
  presentedIndex,
  isLoading,
  onSelectVerse,
  onGoBack,
}: VersesListProps) {
  const { t } = useTranslation('bible')
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onGoBack}
          className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('navigation.back')}
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {bookName} {chapter}
        </span>
      </div>

      <div className="space-y-1 max-h-[calc(100vh-20rem)] overflow-y-auto">
        {verses.map((verse, index) => {
          const isSelected = index === selectedIndex
          const isPresented = index === presentedIndex

          // Styles:
          // - Presented: Green solid background (actively shown on screen)
          // - Selected only: Blue ring outline (ready to present)
          // - Neither: Default hover state
          const getButtonClass = () => {
            if (isPresented) {
              return 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
            }
            if (isSelected) {
              return 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500'
            }
            return 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }

          const getVerseNumberClass = () => {
            if (isPresented) {
              return 'text-green-700 dark:text-green-300'
            }
            if (isSelected) {
              return 'text-indigo-700 dark:text-indigo-300'
            }
            return 'text-gray-500 dark:text-gray-400'
          }

          const getTextClass = () => {
            if (isPresented) {
              return 'text-green-900 dark:text-green-100'
            }
            if (isSelected) {
              return 'text-indigo-900 dark:text-indigo-100'
            }
            return 'text-gray-700 dark:text-gray-200'
          }

          return (
            <button
              key={verse.id}
              ref={isSelected ? selectedRef : null}
              type="button"
              onClick={() => onSelectVerse(index)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${getButtonClass()}`}
            >
              <span className={`font-semibold mr-2 ${getVerseNumberClass()}`}>
                {verse.verse}
              </span>
              <span className={getTextClass()}>{verse.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
