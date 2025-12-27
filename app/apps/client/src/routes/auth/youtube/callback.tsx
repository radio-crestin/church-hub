import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { storeYouTubeTokens } from '~/features/livestream/service'

export const Route = createFileRoute('/auth/youtube/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    accessToken: (search.accessToken as string) || '',
    refreshToken: (search.refreshToken as string) || '',
    expiresAt: (search.expiresAt as string) || '',
    channelId: (search.channelId as string) || '',
    channelName: (search.channelName as string) || '',
    error: (search.error as string) || '',
  }),
  component: YouTubeCallbackPage,
})

function YouTubeCallbackPage() {
  const {
    accessToken,
    refreshToken,
    expiresAt,
    channelId,
    channelName,
    error,
  } = Route.useSearch()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      if (error) {
        setStatus('error')
        setErrorMessage(error)
        return
      }

      if (!accessToken || !refreshToken || !expiresAt) {
        setStatus('error')
        setErrorMessage('Missing token data')
        return
      }

      try {
        await storeYouTubeTokens({
          accessToken,
          refreshToken,
          expiresAt: parseInt(expiresAt, 10),
          channelId: channelId || undefined,
          channelName: channelName || undefined,
        })

        setStatus('success')

        // Redirect to livestream settings after a short delay
        setTimeout(() => {
          navigate({ to: '/livestream' })
        }, 1500)
      } catch (err) {
        setStatus('error')
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to store tokens',
        )
      }
    }

    handleCallback()
  }, [accessToken, refreshToken, expiresAt, error, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-lg">Connecting YouTube account...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-4 text-4xl">✓</div>
            <p className="text-lg text-green-600">
              YouTube account connected successfully!
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Redirecting to livestream settings...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-4 text-4xl">✗</div>
            <p className="text-lg text-red-600">Connection failed</p>
            <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
            <button
              onClick={() => navigate({ to: '/livestream' })}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Go to Livestream Settings
            </button>
          </>
        )}
      </div>
    </div>
  )
}
