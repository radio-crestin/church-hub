import { ChevronDown } from 'lucide-react'

import type { BibleTranslation } from '../types'

interface TranslationSelectorProps {
  translations: BibleTranslation[]
  selectedId: number | undefined
  onSelect: (id: number) => void
  isLoading?: boolean
}

export function TranslationSelector({
  translations,
  selectedId,
  onSelect,
  isLoading,
}: TranslationSelectorProps) {
  if (isLoading) {
    return (
      <div className="h-9 w-32 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
    )
  }

  if (translations.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <select
        value={selectedId || ''}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 pr-8 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
      >
        {translations.map((translation) => (
          <option key={translation.id} value={translation.id}>
            {translation.abbreviation} - {translation.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    </div>
  )
}
