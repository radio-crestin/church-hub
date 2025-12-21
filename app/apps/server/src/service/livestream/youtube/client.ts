import { eq } from 'drizzle-orm'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

import { getDatabase } from '../../../db'
import { youtubeAuth } from '../../../db/schema'

let oauth2Client: OAuth2Client | null = null

/**
 * Get or create the OAuth2 client.
 * For Desktop app credentials with PKCE, client_secret is not required.
 * Token refresh also works without client_secret for installed apps.
 */
export function getOAuth2Client(): OAuth2Client {
  if (!oauth2Client) {
    const clientId = process.env.YOUTUBE_CLIENT_ID

    if (!clientId) {
      throw new Error(
        'YouTube OAuth credentials not configured. Set YOUTUBE_CLIENT_ID environment variable.',
      )
    }

    oauth2Client = new OAuth2Client(clientId)
  }

  return oauth2Client
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
