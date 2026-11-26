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
      case 'downloading':
        return t('batchImport.downloading')
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

  const total = progress?.total ?? 0
  const hasKnownTotal = total > 0
  const percentage = hasKnownTotal
    ? Math.round(((progress?.current ?? 0) / total) * 100)
    : 0

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-panel rounded-xl shadow-popover p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-fg-hint animate-spin" />
            {hasKnownTotal && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium tabular-nums text-fg">
                  {percentage}%
                </span>
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-base font-semibold text-fg">
              {getPhaseText()}
            </h3>

            {progress && (
              <>
                {progress.phase === 'downloading' ? (
                  <p className="text-sm text-fg-hint">
                    {hasKnownTotal
                      ? `${formatBytes(progress.current)} / ${formatBytes(total)}`
                      : formatBytes(progress.current)}
                  </p>
                ) : (
                  hasKnownTotal && (
                    <p className="text-sm text-fg-hint">
                      {t('batchImport.processingProgress', {
                        current: progress.current,
                        total: progress.total,
                      })}
                    </p>
                  )
                )}

                {progress.currentFile && (
                  <p className="text-xs text-fg-hint truncate max-w-xs">
                    {progress.currentFile}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="w-full bg-field rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ease-out ${
                hasKnownTotal ? 'bg-primary' : 'bg-primary animate-pulse'
              }`}
              style={{ width: hasKnownTotal ? `${percentage}%` : '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
