import { eq } from 'drizzle-orm'

import { getAuthenticatedClient, getOAuth2Client } from './client'
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

  const existingAuth = await db.select().from(youtubeAuth).limit(1)

  if (existingAuth.length > 0) {
    await db
      .update(youtubeAuth)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        channelId,
        channelName,
        updatedAt: new Date(),
      })
      .where(eq(youtubeAuth.id, existingAuth[0].id))
  } else {
    await db.insert(youtubeAuth).values({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      channelId,
      channelName,
    })
  }

  return {
    isAuthenticated: true,
    channelId: channelId || undefined,
    channelName: channelName || undefined,
    expiresAt: tokens.expiresAt.getTime(),
  }
}

export async function getAuthStatus(): Promise<YouTubeAuthStatus> {
  const db = getDatabase()
  const authRecords = await db.select().from(youtubeAuth).limit(1)

  if (authRecords.length === 0) {
    return { isAuthenticated: false }
  }

  const auth = authRecords[0]
  const isExpired = auth.expiresAt.getTime() < Date.now()

  if (isExpired) {
    const client = await getAuthenticatedClient()
    if (!client) {
      // Token refresh failed, requires re-authentication
      return {
        isAuthenticated: false,
        requiresReauth: true,
        error: 'refresh_failed',
      }
    }
  }

  return {
    isAuthenticated: true,
    channelId: auth.channelId || undefined,
    channelName: auth.channelName || undefined,
    expiresAt: auth.expiresAt.getTime(),
  }
}

export async function logout(): Promise<void> {
  const db = getDatabase()
  const authRecords = await db.select().from(youtubeAuth).limit(1)

  if (authRecords.length > 0) {
    // Try to revoke credentials if OAuth client is available
    const client = getOAuth2Client()
    if (client) {
      try {
        client.setCredentials({
          access_token: authRecords[0].accessToken,
          refresh_token: authRecords[0].refreshToken,
        })
        await client.revokeCredentials()
      } catch {
        // Revoke credentials silently failed
      }
    }

    await db.delete(youtubeAuth).where(eq(youtubeAuth.id, authRecords[0].id))
  }
}
