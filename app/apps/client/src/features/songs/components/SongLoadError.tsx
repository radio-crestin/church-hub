import { ArrowLeft, CloudOff, Loader2, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'

interface SongLoadErrorProps {
  isRetrying: boolean
  onRetry: () => void
  onBack: () => void
}

/**
 * Shown when a song could not be loaded (server busy or unreachable), which is
 * not the same as a deleted song: the operator can try again or go back.
 */
export function SongLoadError({
  isRetrying,
  onRetry,
  onBack,
}: SongLoadErrorProps) {
  const { t } = useTranslation('songs')

  return (
    <div
      data-testid="song-load-error"
      role="alert"
      className="flex h-full items-center justify-center p-4"
    >
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <CloudOff className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('loadError.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('loadError.description')}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button
            data-testid="song-load-retry"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="mr-2 h-4 w-4" />
            )}
            {t('loadError.retry')}
          </Button>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('loadError.backToSongs')}
          </Button>
        </div>
      </div>
    </div>
  )
}
