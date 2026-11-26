import { eq } from 'drizzle-orm'

import { getDatabase } from '../../../db'
import { youtubeAuth } from '../../../db/schema'
import { openSecret, sealSecret, secretPlaces } from '../../secret-store'

export type YouTubeAuthRecord = typeof youtubeAuth.$inferSelect

/**
 * The YouTube connection with its tokens opened, or null when not connected
 * (or its tokens can't be opened: sign in again).
 */
export async function readYouTubeAuth(): Promise<YouTubeAuthRecord | null> {
  const [row] = await getDatabase().select().from(youtubeAuth).limit(1)
  if (!row) return null
  const accessToken = openSecret(
    row.accessToken,
    secretPlaces.youtubeAccessToken,
  )
  const refreshToken = openSecret(
    row.refreshToken,
    secretPlaces.youtubeRefreshToken,
  )
  if (accessToken === null || refreshToken === null) return null
  return { ...row, accessToken, refreshToken }
}

/** The tokens as stored: sealed. */
export const sealYouTubeTokens = (tokens: {
  accessToken: string
  refreshToken: string
}) => ({
  accessToken: sealSecret(tokens.accessToken, secretPlaces.youtubeAccessToken),
  refreshToken: sealSecret(
    tokens.refreshToken,
    secretPlaces.youtubeRefreshToken,
  ),
})

/** Saves a refreshed access token and its expiry. */
export async function updateYouTubeAccessToken(
  id: number,
  accessToken: string,
  expiresAt: Date,
): Promise<void> {
  await getDatabase()
    .update(youtubeAuth)
    .set({
      accessToken: sealSecret(accessToken, secretPlaces.youtubeAccessToken),
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(youtubeAuth.id, id))
}
