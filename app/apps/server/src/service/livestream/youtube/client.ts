import { eq } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

import { parseGoogleAuthError, type YouTubeAuthError } from './errors'
import { getDatabase } from '../../../db'
import { youtubeAuth } from '../../../db/schema'
import { broadcastYouTubeAuthStatus } from '../../../websocket'

const DEBUG = process.env.DEBUG === 'true'

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
      log('info', 'YouTube OAuth credentials not configured. Token refresh will not be available.')
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

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const db = getDatabase()
  const authRecords = await db.select().from(youtubeAuth).limit(1)

  if (authRecords.length === 0) {
    return null
  }

  const auth = authRecords[0]
  const client = getOAuth2Client()

  // If no OAuth client (credentials not configured), we can't refresh tokens
  // Check if token is expired and require re-auth if so
  if (!client) {
    if (auth.expiresAt.getTime() < Date.now()) {
      log('info', 'Token expired and no credentials for refresh - requires re-auth')
      broadcastYouTubeAuthStatus({
        isAuthenticated: false,
        requiresReauth: true,
        error: 'token_expired',
        updatedAt: Date.now(),
      })
      return null
    }
    // Token still valid, but we can't return a client without credentials
    // Return null - API calls won't work but auth status can still be shown
    return null
  }

  client.setCredentials({
    access_token: auth.accessToken,
    refresh_token: auth.refreshToken,
    expiry_date: auth.expiresAt.getTime(),
  })

  if (auth.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    log('debug', 'Access token expiring soon, attempting refresh')
    try {
      const { credentials } = await client.refreshAccessToken()
      log('info', 'Token refreshed successfully')

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

      client.setCredentials(credentials)
    } catch (error) {
      const authError: YouTubeAuthError = parseGoogleAuthError(error)
      log(
        'error',
        `Token refresh failed: ${authError.code} - ${authError.message}`,
      )

      if (authError.requiresReauth) {
        await clearInvalidAuth()
        broadcastYouTubeAuthStatus({
          isAuthenticated: false,
          requiresReauth: true,
          error: authError.code,
          updatedAt: Date.now(),
        })
      }

      return null
    }
  }

  return client
}

export async function getYouTubeService() {
  const client = await getAuthenticatedClient()

  if (!client) {
    return null
  }

  return google.youtube({ version: 'v3', auth: client })
}
