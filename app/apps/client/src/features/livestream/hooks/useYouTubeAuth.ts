import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import {
  getYouTubeAuthStatus,
  logoutYouTube,
  storePKCESession,
  storeYouTubeTokens,
} from '../service'
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  isTauri,
  openAuthUrl,
} from '../utils'

const YOUTUBE_CLIENT_ID = import.meta.env.VITE_YOUTUBE_CLIENT_ID as string
const YOUTUBE_CLIENT_SECRET = import.meta.env
  .VITE_YOUTUBE_CLIENT_SECRET as string
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'
const YOUTUBE_REDIRECT_URI =
  'http://localhost:3000/api/livestream/youtube/callback'

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
    if (!YOUTUBE_CLIENT_ID) {
      setAuthError('YouTube Client ID not configured')
      return
    }

    setIsAuthenticating(true)
    setAuthError(null)

    try {
      // Generate PKCE values
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)

      // Store verifier in sessionStorage for later use
      sessionStorage.setItem('youtube_code_verifier', codeVerifier)

      // Build auth URL with PKCE parameters
      const authUrl = buildAuthUrl({
        clientId: YOUTUBE_CLIENT_ID,
        redirectUri: YOUTUBE_REDIRECT_URI,
        codeChallenge,
        scope: YOUTUBE_SCOPE,
      })

      // In Tauri, open in external browser - auth status will sync via WebSocket
      // when completed in the browser
      if (isTauri()) {
        // Store PKCE session on server for server-side token exchange
        const sessionId = await storePKCESession({
          codeVerifier,
          codeChallenge,
        })

        // Rebuild auth URL with session ID in state parameter
        const tauriAuthUrl = buildAuthUrl({
          clientId: YOUTUBE_CLIENT_ID,
          redirectUri: YOUTUBE_REDIRECT_URI,
          codeChallenge,
          scope: YOUTUBE_SCOPE,
          state: sessionId,
        })

        await openAuthUrl(tauriAuthUrl, { popupName: 'youtube-auth' })
        // In Tauri, we don't wait for the popup - the WebSocket will notify us
        // Keep authenticating state until WebSocket updates or timeout
        setTimeout(() => {
          if (!storeMutation.isPending) {
            setIsAuthenticating(false)
          }
        }, 60000) // 1 minute timeout
        return
      }

      const popup = await openAuthUrl(authUrl, { popupName: 'youtube-auth' })

      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'youtube-auth-code') {
          // Received authorization code from callback
          const code = event.data.code as string
          const storedVerifier = sessionStorage.getItem('youtube_code_verifier')

          if (!storedVerifier) {
            setAuthError('Code verifier not found')
            setIsAuthenticating(false)
            popup?.close()
            return
          }

          try {
            // Exchange code for tokens using PKCE (direct call to Google)
            const tokens = await exchangeCodeForTokens({
              code,
              clientId: YOUTUBE_CLIENT_ID,
              clientSecret: YOUTUBE_CLIENT_SECRET,
              redirectUri: YOUTUBE_REDIRECT_URI,
              codeVerifier: storedVerifier,
            })

            // Clear the verifier from storage
            sessionStorage.removeItem('youtube_code_verifier')

            // Send tokens to server for storage
            await storeMutation.mutateAsync({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: tokens.expiresAt.getTime(),
            })
          } catch (err) {
            setAuthError(
              err instanceof Error ? err.message : 'Token exchange failed',
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
