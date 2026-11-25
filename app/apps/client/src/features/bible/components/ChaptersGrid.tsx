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
        <Loader2 className="w-6 h-6 animate-spin text-fg" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onGoBack}
        className="flex items-center gap-1.5 text-[13px] text-fg-label hover:text-fg transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        {t('navigation.back')}
      </button>

      <h3 className="text-[13px] font-medium text-fg">{bookName}</h3>

      <div className="grid grid-cols-6 gap-1.5">
        {chapters.map((chapter) => (
          <button
            key={chapter.chapter}
            type="button"
            onClick={() => onSelectChapter(chapter.chapter)}
            className="aspect-square flex items-center justify-center text-[13px] font-medium text-fg-body bg-field hover:bg-hover rounded-md transition-colors"
          >
            {chapter.chapter}
          </button>
        ))}
      </div>
    </div>
  )
}
