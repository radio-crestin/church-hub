import { eq } from 'drizzle-orm'

import { getAuthenticatedClient, getOAuth2Client } from './client'
import { readYouTubeAuth, sealYouTubeTokens } from './youtubeAuthStore'
import { getDatabase } from '../../../db'
import { youtubeAuth } from '../../../db/schema'
import type { YouTubeAuthStatus } from '../types'

interface StoreTokensInput {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  channelId?: string
  channelName?: string
}

// Cache for auth status to avoid repeated token refresh attempts
let authStatusCache: {
  data: YouTubeAuthStatus
  timestamp: number
} | null = null
const AUTH_STATUS_CACHE_TTL = 30 * 1000 // 30 seconds

// Clear the auth status cache (call when auth state changes)
export function clearAuthStatusCache(): void {
  authStatusCache = null
}

/**
 * Stores OAuth tokens received from client after PKCE flow completion.
 * Channel info is provided by the OAuth worker, no YouTube API call needed.
 */
export async function storeTokens(
  tokens: StoreTokensInput,
): Promise<YouTubeAuthStatus> {
  const db = getDatabase()

  // Channel info is provided directly from the OAuth worker
  const channelId = tokens.channelId || null
  const channelName = tokens.channelName || null

  const [existingAuth] = await db.select().from(youtubeAuth).limit(1)

  if (existingAuth) {
    await db
      .update(youtubeAuth)
      .set({
        ...sealYouTubeTokens(tokens),
        expiresAt: tokens.expiresAt,
        channelId,
        channelName,
        updatedAt: new Date(),
      })
      .where(eq(youtubeAuth.id, existingAuth.id))
  } else {
    await db.insert(youtubeAuth).values({
      ...sealYouTubeTokens(tokens),
      expiresAt: tokens.expiresAt,
      channelId,
      channelName,
    })
  }

  const result: YouTubeAuthStatus = {
    isAuthenticated: true,
    channelId: channelId || undefined,
    channelName: channelName || undefined,
    expiresAt: tokens.expiresAt.getTime(),
  }

  // Update cache with new auth status
  authStatusCache = { data: result, timestamp: Date.now() }

  return result
}

export async function getAuthStatus(): Promise<YouTubeAuthStatus> {
  // Return cached result if still fresh
  if (
    authStatusCache &&
    Date.now() - authStatusCache.timestamp < AUTH_STATUS_CACHE_TTL
  ) {
    return authStatusCache.data
  }

  const auth = await readYouTubeAuth()

  if (!auth) {
    const result: YouTubeAuthStatus = { isAuthenticated: false }
    authStatusCache = { data: result, timestamp: Date.now() }
    return result
  }

  const isExpired = auth.expiresAt.getTime() < Date.now()

  if (isExpired) {
    const client = await getAuthenticatedClient()
    if (!client) {
      // Token refresh failed, requires re-authentication
      const result: YouTubeAuthStatus = {
        isAuthenticated: false,
        requiresReauth: true,
        error: 'refresh_failed',
      }
      authStatusCache = { data: result, timestamp: Date.now() }
      return result
    }
  }

  const result: YouTubeAuthStatus = {
    isAuthenticated: true,
    channelId: auth.channelId || undefined,
    channelName: auth.channelName || undefined,
    expiresAt: auth.expiresAt.getTime(),
  }
  authStatusCache = { data: result, timestamp: Date.now() }
  return result
}

export async function logout(): Promise<void> {
  // Clear cache immediately
  clearAuthStatusCache()

  const auth = await readYouTubeAuth()

  if (auth) {
    // Try to revoke credentials if OAuth client is available
    const client = getOAuth2Client()
    if (client) {
      try {
        client.setCredentials({
          access_token: auth.accessToken,
          refresh_token: auth.refreshToken,
        })
        await client.revokeCredentials()
      } catch {
        // Revoke credentials silently failed
      }
    }
  }
  // Signed out even when the tokens couldn't be opened.
  await getDatabase().delete(youtubeAuth)
}
