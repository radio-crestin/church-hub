import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import {
  getYouTubeAuthStatus,
  logoutYouTube,
  storeYouTubeTokens,
} from '../service'
import { isTauri, openAuthUrl } from '../utils'

const YOUTUBE_OAUTH_SERVER = import.meta.env.VITE_YOUTUBE_OAUTH_SERVER as string

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
    if (!YOUTUBE_OAUTH_SERVER) {
      setAuthError('YouTube OAuth server not configured')
      return
    }

    setIsAuthenticating(true)
    setAuthError(null)

    try {
      // Always use localhost:3000 for OAuth callbacks (server handles the app)
      const callbackOrigin = 'http://localhost:3000'

      // Build auth server URL
      const authUrl = new URL('/auth/youtube', YOUTUBE_OAUTH_SERVER)
      authUrl.searchParams.set('origin', callbackOrigin)

      // In Tauri, use redirect mode with a return URL
      if (isTauri()) {
        authUrl.searchParams.set('mode', 'redirect')
        authUrl.searchParams.set(
          'returnUrl',
          `${callbackOrigin}/auth/youtube/callback`,
        )

        await openAuthUrl(authUrl.toString(), { popupName: 'youtube-auth' })
        // In Tauri, we don't wait for the popup - the WebSocket will notify us
        // Keep authenticating state until WebSocket updates or timeout
        setTimeout(() => {
          if (!storeMutation.isPending) {
            setIsAuthenticating(false)
          }
        }, 60000) // 1 minute timeout
        return
      }

      // Browser popup flow - use postMessage mode (default)
      authUrl.searchParams.set('mode', 'postMessage')

      const popup = await openAuthUrl(authUrl.toString(), {
        popupName: 'youtube-auth',
      })

      const handleMessage = async (event: MessageEvent) => {
        // Validate origin is from our OAuth server
        const oauthServerOrigin = new URL(YOUTUBE_OAUTH_SERVER).origin
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
            await storeMutation.mutateAsync({
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
