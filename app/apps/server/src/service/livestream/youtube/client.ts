import { eq } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

import { getDatabase } from '../../../db'
import { youtubeAuth } from '../../../db/schema'

const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl']

let oauth2Client: OAuth2Client | null = null

export function getOAuth2Client(): OAuth2Client {
  if (!oauth2Client) {
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
    const redirectUri =
      process.env.YOUTUBE_REDIRECT_URI ||
      'http://localhost:3000/api/livestream/youtube/callback'

    if (!clientId || !clientSecret) {
      throw new Error(
        'YouTube OAuth credentials not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables.',
      )
    }

    oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
  }

  return oauth2Client
}

export function getAuthUrl(): string {
  const client = getOAuth2Client()

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
}> {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain tokens from Google')
  }

  const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600 * 1000)

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  }
}

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const db = getDatabase()
  const authRecords = await db.select().from(youtubeAuth).limit(1)

  if (authRecords.length === 0) {
    return null
  }

  const auth = authRecords[0]
  const client = getOAuth2Client()

  client.setCredentials({
    access_token: auth.accessToken,
    refresh_token: auth.refreshToken,
    expiry_date: auth.expiresAt.getTime(),
  })

  if (auth.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      const { credentials } = await client.refreshAccessToken()

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
    } catch {
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
