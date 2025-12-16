import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { BibleChapter } from '../types'

interface ChaptersGridProps {
  bookName: string
  chapters: BibleChapter[]
  isLoading: boolean
  onSelectChapter: (chapter: number) => void
  onGoBack: () => void
}

export function ChaptersGrid({
  bookName,
  chapters,
  isLoading,
  onSelectChapter,
  onGoBack,
}: ChaptersGridProps) {
  const { t } = useTranslation('bible')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onGoBack}
        className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
      >
        <ArrowLeft size={16} />
        {t('navigation.back')}
      </button>

      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
        {bookName}
      </h3>

      <div className="grid grid-cols-6 gap-1.5">
        {chapters.map((chapter) => (
          <button
            key={chapter.chapter}
            type="button"
            onClick={() => onSelectChapter(chapter.chapter)}
            className="aspect-square flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-md transition-colors"
          >
            {chapter.chapter}
          </button>
        ))}
      </div>
    </div>
  )
}
