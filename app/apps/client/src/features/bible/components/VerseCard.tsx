import { ListPlus, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { BibleSearchResult, BibleVerse } from '../types'
import { formatVerseReference } from '../types'

interface VerseCardProps {
  verse: BibleVerse | BibleSearchResult
  translationAbbreviation?: string
  onPresentNow?: (verse: BibleVerse | BibleSearchResult) => void
  onAddToQueue?: (verse: BibleVerse | BibleSearchResult) => void
  highlightedText?: string
}

export function VerseCard({
  verse,
  translationAbbreviation,
  onPresentNow,
  onAddToQueue,
  highlightedText,
}: VerseCardProps) {
  const { t } = useTranslation('bible')

  const reference = formatVerseReference(
    verse.bookName,
    verse.chapter,
    verse.verse,
    translationAbbreviation,
  )

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
            {reference}
          </h3>
          <p
            className="mt-1 text-gray-600 dark:text-gray-300 text-sm line-clamp-3"
            dangerouslySetInnerHTML={{
              __html: highlightedText || verse.text,
            }}
          />
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddToQueue && (
            <button
              type="button"
              onClick={() => onAddToQueue(verse)}
              className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title={t('actions.addToQueue')}
            >
              <ListPlus size={16} />
            </button>
          )}
          {onPresentNow && (
            <button
              type="button"
              onClick={() => onPresentNow(verse)}
              className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              title={t('actions.presentNow')}
            >
              <Play size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
