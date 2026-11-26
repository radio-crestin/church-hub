import { ListPlus, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { HighlightedText } from '~/ui/search'
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
    <div className="group bg-panel rounded-lg border border-line p-4 hover:border-line-strong transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-fg text-sm">{reference}</h3>
          <p className="mt-1 text-fg-label text-sm line-clamp-3 [&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-400/60 [&_mark]:rounded-sm [&_mark]:px-0.5">
            <HighlightedText text={highlightedText || verse.text} />
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddToQueue && (
            <button
              type="button"
              onClick={() => onAddToQueue(verse)}
              className="p-1.5 rounded-md text-fg-label hover:bg-hover hover:text-fg transition-colors"
              title={t('actions.addToQueue')}
            >
              <ListPlus size={16} strokeWidth={1.5} />
            </button>
          )}
          {onPresentNow && (
            <button
              type="button"
              onClick={() => onPresentNow(verse)}
              className="p-1.5 rounded-md text-fg-label hover:bg-hover hover:text-fg transition-colors"
              title={t('actions.presentNow')}
            >
              <Play size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
