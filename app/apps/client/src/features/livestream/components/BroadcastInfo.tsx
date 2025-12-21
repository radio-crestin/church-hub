import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useBroadcastMessage, useOBSConnection, useStreaming } from '../hooks'

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function StudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.44-6.19l-2.35 3.02-1.56-1.88c-.2-.25-.58-.24-.78.01l-1.74 2.23c-.26.33-.02.81.39.81h8.98c.41 0 .65-.47.4-.8l-2.55-3.39c-.19-.26-.59-.26-.79 0z" />
    </svg>
  )
}

export function BroadcastInfo() {
  const { t } = useTranslation('livestream')
  const { activeBroadcast, isLoadingBroadcast, isStopping } = useStreaming()
  const { isStreaming } = useOBSConnection()
  const { message, fetchMessage, copyMessage, copied, isLoading } =
    useBroadcastMessage()

  useEffect(() => {
    if (activeBroadcast?.url && !message && !isLoading) {
      fetchMessage(activeBroadcast.url).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBroadcast?.url])

  if (isLoadingBroadcast) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">
          {t('broadcast.loading')}
        </p>
      </div>
    )
  }

  if (!activeBroadcast || !isStreaming || isStopping) {
    return null
  }

  const displayMessage = message || activeBroadcast.url

  const getVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
    return match ? match[1] : null
  }

  const videoId = getVideoId(activeBroadcast.url)
  const studioUrl = videoId
    ? `https://studio.youtube.com/video/${videoId}/livestreaming`
    : null

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg whitespace-pre-wrap break-words">
          {displayMessage}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copyMessage(activeBroadcast.url)}
            disabled={isLoading}
          >
            {copied ? t('broadcast.messageCopied') : t('broadcast.copyMessage')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(activeBroadcast.url, '_blank')}
            className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
          >
            <YouTubeIcon className="w-4 h-4 mr-1.5" />
            {t('broadcast.watchLive')}
          </Button>
          {studioUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(studioUrl, '_blank')}
              className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <StudioIcon className="w-4 h-4 mr-1.5" />
              {t('broadcast.openStudio')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
