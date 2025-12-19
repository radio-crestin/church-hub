import { Loader2 } from 'lucide-react'

import type { MultiTranslationVerseResult } from '../hooks/useMultiTranslationVerse'

interface MultiTranslationVerseProps {
  results: MultiTranslationVerseResult[]
  isLoading: boolean
  verseNumber: number
}

export function MultiTranslationVerse({
  results,
  isLoading,
  verseNumber,
}: MultiTranslationVerseProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
      </div>
    )
  }

  // Filter out results where we couldn't find the verse
  const validResults = results.filter((r) => r.verse !== null)

  if (validResults.length === 0) {
    return null
  }

  // If only one translation, don't show the stacked view
  if (validResults.length === 1) {
    return null
  }

  return (
    <div className="mt-2 space-y-2 pl-6 border-l-2 border-indigo-200 dark:border-indigo-700">
      {validResults.map(({ translation, verse }) => (
        <div key={translation.id} className="text-sm">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mr-2">
            {translation.abbreviation}
          </span>
          <span className="text-gray-700 dark:text-gray-200">
            {verse?.text}
          </span>
        </div>
      ))}
    </div>
  )
}
