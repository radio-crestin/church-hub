import { FileText, LayoutList } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type LocalSlide, SongSlideList } from './SongSlideList'
import { SongSlidesTextEditor } from './SongSlidesTextEditor'

interface SongSlidesSectionProps {
  slides: LocalSlide[]
  presentedSlideId?: number | null
  onSlidesChange: (slides: LocalSlide[]) => void
  onPresentSlide?: (slideId: number) => void
  isLoading?: boolean
}

export function SongSlidesSection({
  slides,
  presentedSlideId,
  onSlidesChange,
  onPresentSlide,
  isLoading = false,
}: SongSlidesSectionProps) {
  const { t } = useTranslation(['songs'])
  const [isTextMode, setIsTextMode] = useState(false)

  return (
    <div className="bg-panel rounded-lg border border-line overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-app border-b border-line">
        <h2 className="text-base font-semibold text-fg">
          {t('editor.slides')} ({isLoading ? '-' : slides.length})
        </h2>
        <button
          type="button"
          onClick={() => setIsTextMode((current) => !current)}
          data-testid="song-slides-toggle-text-mode"
          disabled={isLoading}
          className="flex items-center gap-2 h-8 px-3 text-sm font-medium bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-hover rounded-lg transition-colors disabled:opacity-50"
        >
          {isTextMode ? (
            <LayoutList className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <FileText className="w-4 h-4" strokeWidth={1.5} />
          )}
          {isTextMode ? t('actions.editAsSlides') : t('actions.editAsText')}
        </button>
      </div>
      <div className="p-6 bg-field">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-32 bg-field rounded-lg animate-pulse" />
            <div className="h-32 bg-field rounded-lg animate-pulse" />
          </div>
        ) : isTextMode ? (
          <SongSlidesTextEditor
            slides={slides}
            onSlidesChange={onSlidesChange}
          />
        ) : (
          <SongSlideList
            slides={slides}
            presentedSlideId={presentedSlideId}
            onSlidesChange={onSlidesChange}
            onPresentSlide={onPresentSlide}
          />
        )}
      </div>
    </div>
  )
}
