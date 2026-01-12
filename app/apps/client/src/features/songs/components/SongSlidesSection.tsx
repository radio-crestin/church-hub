import { FileText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EditSlidesAsTextModal } from './EditSlidesAsTextModal'
import { type LocalSlide, SongSlideList } from './SongSlideList'

interface SongSlidesSectionProps {
  slides: LocalSlide[]
  onSlidesChange: (slides: LocalSlide[]) => void
  isLoading?: boolean
}

export function SongSlidesSection({
  slides,
  onSlidesChange,
  isLoading = false,
}: SongSlidesSectionProps) {
  const { t } = useTranslation(['songs'])
  const [showEditAsTextModal, setShowEditAsTextModal] = useState(false)

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('editor.slides')} ({isLoading ? '-' : slides.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowEditAsTextModal(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-900 bg-amber-400 hover:bg-amber-500 dark:text-amber-100 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <FileText className="w-5 h-5" />
            {t('actions.editAsText')}
          </button>
        </div>
        <div className="p-6 bg-gray-100 dark:bg-gray-900/30">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
          ) : (
            <SongSlideList slides={slides} onSlidesChange={onSlidesChange} />
          )}
        </div>
      </div>

      <EditSlidesAsTextModal
        isOpen={showEditAsTextModal}
        onClose={() => setShowEditAsTextModal(false)}
        slides={slides}
        onSlidesChange={onSlidesChange}
      />
    </>
  )
}
