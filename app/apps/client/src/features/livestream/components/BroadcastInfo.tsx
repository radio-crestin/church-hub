import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { Tooltip } from '../../../ui/tooltip'
import { useBroadcastMessage, useOBSConnection, useStreaming } from '../hooks'
import type { StreamStartProgress } from '../types'
import { openExternalUrl } from '../utils/openInBrowser'

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

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function StreamStartProgressUI({
  progress,
  t,
}: {
  progress: StreamStartProgress
  t: (key: string) => string
}) {
  if (progress.step === 'error') {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm text-red-600 dark:text-red-400">
            {progress.error || t('errors.startStreamFailed')}
          </span>
        </div>
      </div>
    )
  }

  if (progress.step === 'completed') {
    return null
  }

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t(`stream.progress.${progress.step}`)}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {progress.progress}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {progress.message}
        </p>
      </div>
    </div>
  )
}

export function BroadcastInfo() {
  const { t } = useTranslation('livestream')
  const {
    activeBroadcast,
    isLoadingBroadcast,
    isStopping,
    streamStartProgress,
  } = useStreaming()
  const { isStreaming } = useOBSConnection()
  const { message, fetchMessage, copyMessage, copied, isLoading } =
    useBroadcastMessage()

  useEffect(() => {
    if (activeBroadcast?.url && !message && !isLoading) {
      fetchMessage(activeBroadcast.url).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBroadcast?.url])

  // Show progress during stream start
  if (streamStartProgress && streamStartProgress.step !== 'completed') {
    return <StreamStartProgressUI progress={streamStartProgress} t={t} />
  }

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
        <div className="relative flex-1 px-3 py-2 pr-10 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg whitespace-pre-wrap break-words">
          {displayMessage}
          <Tooltip
            content={
              copied ? t('broadcast.copied') : t('broadcast.copyToClipboard')
            }
            position="left"
          >
            <button
              type="button"
              onClick={() => copyMessage(activeBroadcast.url)}
              disabled={isLoading}
              className="absolute right-2 top-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
        </div>
        <div className="flex gap-2 shrink-0">
          <Tooltip content={t('broadcast.watchLive')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openExternalUrl(activeBroadcast.url)}
              className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
            >
              <YouTubeIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
          {studioUrl && (
            <Tooltip content={t('broadcast.openStudio')} position="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openExternalUrl(studioUrl)}
                className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <StudioIcon className="w-5 h-5" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
