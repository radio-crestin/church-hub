import { eq } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

import { parseGoogleAuthError, type YouTubeAuthError } from './errors'
import { getDatabase } from '../../../db'
import { youtubeAuth } from '../../../db/schema'
import { broadcastYouTubeAuthStatus } from '../../../websocket'

const DEBUG = process.env.DEBUG === 'true'
const YOUTUBE_OAUTH_SERVER =
  process.env.YOUTUBE_OAUTH_SERVER || 'https://churchub-backend.radiocrestin.ro'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [youtube-client] ${message}`)
}

let oauth2Client: OAuth2Client | null = null
let credentialsAvailable = true

/**
 * Get or create the OAuth2 client.
 * Returns null if credentials are not configured.
 * Credentials are optional - if not available, token refresh won't work
 * and users will need to re-authenticate when tokens expire.
 */
export function getOAuth2Client(): OAuth2Client | null {
  if (!credentialsAvailable) {
    return null
  }

  if (!oauth2Client) {
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      log(
        'info',
        'YouTube OAuth credentials not configured. Token refresh will not be available.',
      )
      credentialsAvailable = false
      return null
    }

    oauth2Client = new OAuth2Client(clientId, clientSecret)
  }

  return oauth2Client
}

/**
 * Clears invalid authentication from database and broadcasts re-auth status.
 */
async function clearInvalidAuth(): Promise<void> {
  const db = getDatabase()
  await db.delete(youtubeAuth)
  log('info', 'Cleared invalid YouTube authentication from database')
}

interface RefreshTokenResponse {
  success?: boolean
  tokens?: {
    accessToken: string
    refreshToken: string
    expiresAt: number
  }
  error?: string
  requiresReauth?: boolean
}

/**
 * Refreshes tokens using the OAuth worker.
 * This allows token refresh even without local OAuth credentials.
 */
async function refreshTokensViaWorker(
  refreshToken: string,
): Promise<RefreshTokenResponse> {
  try {
    const response = await fetch(
      `${YOUTUBE_OAUTH_SERVER}/auth/youtube/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      },
    )

    const data = (await response.json()) as RefreshTokenResponse

    if (!response.ok) {
      return {
        error: data.error || 'Token refresh failed',
        requiresReauth: data.requiresReauth ?? response.status === 401,
      }
    }

    return data
  } catch (error) {
    log('error', `Failed to refresh token via worker: ${error}`)
    return {
      error: error instanceof Error ? error.message : 'Network error',
      requiresReauth: false,
    }
  }
}

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const db = getDatabase()
  const authRecords = await db.select().from(youtubeAuth).limit(1)

  if (authRecords.length === 0) {
    return null
  }

  const auth = authRecords[0]
  const needsRefresh = auth.expiresAt.getTime() < Date.now() + 5 * 60 * 1000

  // Try to refresh tokens if needed
  if (needsRefresh) {
    log('debug', 'Access token expiring soon, attempting refresh')

    // First try local OAuth client if available
    const localClient = getOAuth2Client()
    if (localClient) {
      localClient.setCredentials({
        access_token: auth.accessToken,
        refresh_token: auth.refreshToken,
        expiry_date: auth.expiresAt.getTime(),
      })

      try {
        const { credentials } = await localClient.refreshAccessToken()
        log('info', 'Token refreshed successfully via local client')

        await db
          .update(youtubeAuth)
          .set({
            accessToken: credentials.access_token!,
            expiresAt: new Date(
              credentials.expiry_date || Date.now() + 3600 * 1000,
            ),
            updatedAt: new Date(),
          })
          .where(eq(youtubeAuth.id, auth.id))

        localClient.setCredentials(credentials)
        return localClient
      } catch (error) {
        const authError: YouTubeAuthError = parseGoogleAuthError(error)
        log(
          'error',
          `Local token refresh failed: ${authError.code} - ${authError.message}`,
        )

        if (authError.requiresReauth) {
          await clearInvalidAuth()
          broadcastYouTubeAuthStatus({
            isAuthenticated: false,
            requiresReauth: true,
            error: authError.code,
            updatedAt: Date.now(),
          })
          return null
        }
      }
    }

    // Fall back to OAuth worker for refresh
    log('debug', 'Attempting token refresh via OAuth worker')
    const workerResult = await refreshTokensViaWorker(auth.refreshToken)

    if (workerResult.success && workerResult.tokens) {
      log('info', 'Token refreshed successfully via OAuth worker')

      await db
        .update(youtubeAuth)
        .set({
          accessToken: workerResult.tokens.accessToken,
          expiresAt: new Date(workerResult.tokens.expiresAt),
          updatedAt: new Date(),
        })
        .where(eq(youtubeAuth.id, auth.id))

      // Create a simple OAuth2Client with the new credentials for googleapis
      const client = new OAuth2Client()
      client.setCredentials({
        access_token: workerResult.tokens.accessToken,
        refresh_token: workerResult.tokens.refreshToken,
        expiry_date: workerResult.tokens.expiresAt,
      })
      return client
    }

    if (workerResult.requiresReauth) {
      log('error', `Worker token refresh failed: ${workerResult.error}`)
      await clearInvalidAuth()
      broadcastYouTubeAuthStatus({
        isAuthenticated: false,
        requiresReauth: true,
        error: 'invalid_grant',
        updatedAt: Date.now(),
      })
      return null
    }

    // Network error or other non-auth failure - still try to use existing token if not fully expired
    if (auth.expiresAt.getTime() > Date.now()) {
      log(
        'warning',
        'Token refresh failed but token not yet expired, using existing token',
      )
      const client = new OAuth2Client()
      client.setCredentials({
        access_token: auth.accessToken,
        refresh_token: auth.refreshToken,
        expiry_date: auth.expiresAt.getTime(),
      })
      return client
    }

    // Token fully expired and refresh failed
    log('error', 'Token expired and refresh failed')
    broadcastYouTubeAuthStatus({
      isAuthenticated: false,
      requiresReauth: true,
      error: 'token_expired',
      updatedAt: Date.now(),
    })
    return null
  }

  // Token is still valid, create client with current credentials
  const client = new OAuth2Client()
  client.setCredentials({
    access_token: auth.accessToken,
    refresh_token: auth.refreshToken,
    expiry_date: auth.expiresAt.getTime(),
  })
  return client
}

export async function getYouTubeService() {
  const client = await getAuthenticatedClient()

  if (!client) {
    return null
  }

  return google.youtube({ version: 'v3', auth: client })
}

/**
 * Gets the current valid access token from the database.
 * Returns null if not authenticated or token is expired.
 * This can be used for direct API calls without needing OAuth credentials.
 */
export async function getAccessToken(): Promise<string | null> {
  const db = getDatabase()
  const authRecords = await db.select().from(youtubeAuth).limit(1)

  if (authRecords.length === 0) {
    return null
  }

  const auth = authRecords[0]

  // Check if token is expired or expiring soon
  if (auth.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    log('debug', 'Token expired or expiring soon, attempting refresh')

    // Try local client first if credentials available
    const client = getOAuth2Client()
    if (client) {
      try {
        client.setCredentials({
          access_token: auth.accessToken,
          refresh_token: auth.refreshToken,
          expiry_date: auth.expiresAt.getTime(),
        })
        const { credentials } = await client.refreshAccessToken()
        log('info', 'Token refreshed successfully via local client')

        await db
          .update(youtubeAuth)
          .set({
            accessToken: credentials.access_token!,
            expiresAt: new Date(
              credentials.expiry_date || Date.now() + 3600 * 1000,
            ),
            updatedAt: new Date(),
          })
          .where(eq(youtubeAuth.id, auth.id))

        return credentials.access_token!
      } catch (error) {
        log('error', `Local token refresh failed: ${error}`)
        // Fall through to try worker
      }
    }

    // Try OAuth worker for refresh
    log('debug', 'Attempting token refresh via OAuth worker')
    const workerResult = await refreshTokensViaWorker(auth.refreshToken)

    if (workerResult.success && workerResult.tokens) {
      log('info', 'Token refreshed successfully via OAuth worker')

      await db
        .update(youtubeAuth)
        .set({
          accessToken: workerResult.tokens.accessToken,
          expiresAt: new Date(workerResult.tokens.expiresAt),
          updatedAt: new Date(),
        })
        .where(eq(youtubeAuth.id, auth.id))

      return workerResult.tokens.accessToken
    }

    if (workerResult.requiresReauth) {
      log('error', `Worker token refresh failed: ${workerResult.error}`)
      await clearInvalidAuth()
      broadcastYouTubeAuthStatus({
        isAuthenticated: false,
        requiresReauth: true,
        error: 'invalid_grant',
        updatedAt: Date.now(),
      })
      return null
    }

    // Network error - use existing token if not fully expired
    if (auth.expiresAt.getTime() > Date.now()) {
      log('warning', 'Token refresh failed but token not yet expired')
      return auth.accessToken
    }

    // Token fully expired and refresh failed
    log('error', 'Token expired and refresh failed')
    broadcastYouTubeAuthStatus({
      isAuthenticated: false,
      requiresReauth: true,
      error: 'token_expired',
      updatedAt: Date.now(),
    })
    return null
  }

  return auth.accessToken
}

/**
 * Makes a direct call to the YouTube API using the access token.
 * This works without OAuth credentials configured.
 */
export async function youtubeApiFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options: RequestInit = {},
): Promise<T> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Not authenticated with YouTube')
  }

  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage =
      (errorData as { error?: { message?: string } })?.error?.message ||
      response.statusText
    throw new Error(`YouTube API error: ${errorMessage}`)
  }

  return response.json()
}
