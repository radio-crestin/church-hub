import { eq } from 'drizzle-orm'
import { google } from 'googleapis'

import { getAuthenticatedClient, getOAuth2Client } from './client'
import { getDatabase } from '../../../db'
import { youtubeAuth } from '../../../db/schema'
import type { YouTubeAuthStatus } from '../types'

interface StoreTokensInput {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/**
 * Stores OAuth tokens received from client after PKCE flow completion.
 * This is called after the client exchanges the authorization code for tokens.
 */
export async function storeTokens(
  tokens: StoreTokensInput,
): Promise<YouTubeAuthStatus> {
  const db = getDatabase()

  const client = getOAuth2Client()
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt.getTime(),
  })

  const youtube = google.youtube({ version: 'v3', auth: client })
  const channelResponse = await youtube.channels.list({
    part: ['snippet'],
    mine: true,
  })

  const channel = channelResponse.data.items?.[0]
  const channelId = channel?.id || null
  const channelName = channel?.snippet?.title || null

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
      return { isAuthenticated: false }
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
    try {
      const client = getOAuth2Client()
      client.setCredentials({
        access_token: authRecords[0].accessToken,
        refresh_token: authRecords[0].refreshToken,
      })
      await client.revokeCredentials()
    } catch {
      // Revoke credentials silently failed
    }

    await db.delete(youtubeAuth).where(eq(youtubeAuth.id, authRecords[0].id))
  }
}
