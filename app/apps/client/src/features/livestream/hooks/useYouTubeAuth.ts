import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import {
  getYouTubeAuthStatus,
  logoutYouTube,
  startYouTubeSignIn,
  storeYouTubeTokens,
} from '../service'
import { isTauri, openAuthUrl } from '../utils'

export function useYouTubeAuth() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('livestream')
  const { showToast } = useToast()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const previousRequiresReauth = useRef<boolean | undefined>(undefined)

  const query = useQuery({
    queryKey: ['livestream', 'youtube', 'auth'],
    queryFn: getYouTubeAuthStatus,
    staleTime: 5 * 60 * 1000,
  })

  // Show toast when requiresReauth becomes true
  useEffect(() => {
    const requiresReauth = query.data?.requiresReauth
    if (
      requiresReauth &&
      previousRequiresReauth.current !== true &&
      !isAuthenticating
    ) {
      showToast(t('errors.youtubeSessionExpired'), 'error')
    }
    previousRequiresReauth.current = requiresReauth
  }, [query.data?.requiresReauth, isAuthenticating, showToast, t])

  const storeMutation = useMutation({
    mutationFn: storeYouTubeTokens,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'youtube'] })
      setIsAuthenticating(false)
      setAuthError(null)
    },
    onError: (error) => {
      setAuthError(
        error instanceof Error ? error.message : 'Failed to store tokens',
      )
      setIsAuthenticating(false)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: logoutYouTube,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestream', 'youtube'] })
    },
  })

  // Reset authenticating state when query data shows authenticated
  // This handles the case where auth completes via WebSocket (e.g., Tauri flow)
  useEffect(() => {
    if (query.data?.isAuthenticated && isAuthenticating) {
      setIsAuthenticating(false)
      setAuthError(null)
    }
  }, [query.data?.isAuthenticated, isAuthenticating])

  const openLoginPopup = useCallback(async () => {
    setIsAuthenticating(true)
    setAuthError(null)

    try {
      const mode = isTauri() ? 'redirect' : 'postMessage'
      const { state, authUrl } = await startYouTubeSignIn(mode)

      // In Tauri, the backend redirects back to the app's callback page with
      // the state; the WebSocket tells us when the tokens are stored.
      if (mode === 'redirect') {
        await openAuthUrl(authUrl, { popupName: 'youtube-auth' })
        // Keep authenticating state until WebSocket updates or timeout
        setTimeout(() => {
          if (!storeMutation.isPending) {
            setIsAuthenticating(false)
          }
        }, 60000) // 1 minute timeout
        return
      }

      // Browser popup flow: the backend posts the tokens to this window
      const oauthServerOrigin = new URL(authUrl).origin
      const popup = await openAuthUrl(authUrl, { popupName: 'youtube-auth' })

      const handleMessage = async (event: MessageEvent) => {
        // Validate origin is from our OAuth server
        if (event.origin !== oauthServerOrigin) return

        if (event.data?.type === 'youtube-auth-success') {
          const { tokens } = event.data as {
            tokens: {
              accessToken: string
              refreshToken: string
              expiresAt: number
            }
          }

          try {
            // Send tokens to server for storage
            // Tokens from the OAuth server's own window (origin checked above)
            await storeMutation.mutateAsync({
              state,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt,
            })
          } catch (err) {
            setAuthError(
              err instanceof Error ? err.message : 'Failed to store tokens',
            )
            setIsAuthenticating(false)
          }

          popup?.close()
        } else if (event.data?.type === 'youtube-auth-error') {
          setAuthError(event.data.error || 'Authentication failed')
          setIsAuthenticating(false)
          popup?.close()
        }

        window.removeEventListener('message', handleMessage)
      }

      window.addEventListener('message', handleMessage)

      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          // Only set authenticating to false if no auth was successful
          if (!storeMutation.isPending) {
            setIsAuthenticating(false)
          }
        }
      }, 500)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed')
      setIsAuthenticating(false)
    }
  }, [storeMutation])

  return {
    ...query,
    isAuthenticated: query.data?.isAuthenticated ?? false,
    channelName: query.data?.channelName,
    channelId: query.data?.channelId,
    requiresReauth: query.data?.requiresReauth ?? false,
    login: openLoginPopup,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    isAuthenticating,
    authError,
  }
}
