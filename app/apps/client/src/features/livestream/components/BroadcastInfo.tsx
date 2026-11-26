import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { Tooltip } from '../../../ui/tooltip'
import { useBroadcastMessage, useStreaming } from '../hooks'
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
      strokeWidth="1.5"
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
      strokeWidth="1.5"
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
  onRetry,
  onDismiss,
}: {
  progress: StreamStartProgress
  t: (key: string) => string
  onRetry?: () => void
  onDismiss?: () => void
}) {
  if (progress.step === 'error') {
    return (
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-red-600 dark:text-red-400">
            {progress.error || t('errors.startStreamFailed')}
          </span>
          <div className="flex gap-2 shrink-0">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                {t('errors.retry')}
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                {t('errors.dismiss')}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (progress.step === 'completed') {
    return null
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-fg-body">
            {t(`stream.progress.${progress.step}`)}
          </span>
          <span className="text-xs text-fg-hint tabular-nums">
            {progress.progress}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-field">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <p className="text-xs text-fg-hint">{progress.message}</p>
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
    clearStreamStartProgress,
    start,
    isLive,
  } = useStreaming()
  const { message, fetchMessage, copyMessage, copied } = useBroadcastMessage()

  useEffect(() => {
    if (activeBroadcast?.url) {
      fetchMessage(activeBroadcast.url).catch(() => {})
    }
  }, [activeBroadcast?.url, fetchMessage])

  const handleRetry = () => {
    clearStreamStartProgress()
    start()
  }

  // Show progress during stream start
  if (streamStartProgress && streamStartProgress.step !== 'completed') {
    return (
      <StreamStartProgressUI
        progress={streamStartProgress}
        t={t}
        onRetry={handleRetry}
        onDismiss={clearStreamStartProgress}
      />
    )
  }

  if (isLoadingBroadcast) {
    return (
      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="text-[13px] text-fg-hint">{t('broadcast.loading')}</p>
      </div>
    )
  }

  if (!activeBroadcast || !isLive || isStopping) {
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
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <Tooltip
          content={
            copied ? t('broadcast.copied') : t('broadcast.copyToClipboard')
          }
          position="top"
          className="flex-1"
        >
          <div
            className="relative w-full px-3 py-2 pr-10 text-[13px] text-fg-body bg-field rounded-lg whitespace-pre-wrap break-words cursor-pointer hover:bg-hover transition-colors"
            onClick={() => copyMessage(activeBroadcast.url)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                copyMessage(activeBroadcast.url)
              }
            }}
          >
            {displayMessage}
            <span className="absolute right-2 top-2 p-1.5 text-fg-hint">
              {copied ? (
                <CheckIcon className="w-4 h-4 text-ok" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </span>
          </div>
        </Tooltip>
        <div className="flex gap-2 shrink-0">
          <Tooltip content={t('broadcast.watchLive')} position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openExternalUrl(activeBroadcast.url)}
              className="text-fg-label hover:text-fg"
            >
              <YouTubeIcon className="w-4 h-4" />
            </Button>
          </Tooltip>
          {studioUrl && (
            <Tooltip content={t('broadcast.openStudio')} position="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openExternalUrl(studioUrl)}
                className="text-fg-label hover:text-fg"
              >
                <StudioIcon className="w-4 h-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
