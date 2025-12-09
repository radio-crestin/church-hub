import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ImportProgress } from '../types'

interface ImportProgressModalProps {
  isOpen: boolean
  progress: ImportProgress | null
}

export function ImportProgressModal({
  isOpen,
  progress,
}: ImportProgressModalProps) {
  const { t } = useTranslation('songs')

  if (!isOpen) return null

  const getPhaseText = () => {
    if (!progress) return t('batchImport.processing')

    switch (progress.phase) {
      case 'extracting':
        return t('batchImport.extracting')
      case 'converting':
        return t('batchImport.converting')
      case 'parsing':
        return t('batchImport.parsing')
      case 'saving':
        return t('batchImport.saving')
      default:
        return t('batchImport.processing')
    }
  }

  const percentage =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
            {progress && progress.total > 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-semibold text-indigo-600">
                  {percentage}%
                </span>
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {getPhaseText()}
            </h3>

            {progress && progress.total > 0 && (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('batchImport.processingProgress', {
                    current: progress.current,
                    total: progress.total,
                  })}
                </p>

                {progress.currentFile && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">
                    {progress.currentFile}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
