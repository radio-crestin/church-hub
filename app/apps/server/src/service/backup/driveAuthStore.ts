import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { googleDriveAuth } from '../../db/schema'
import { openSecret, sealSecret, secretPlaces } from '../secret-store'

/** Token set persisted after a successful Drive authorization. */
export interface DriveTokens {
  accessToken: string
  refreshToken: string
  /** Expiry as ms epoch. */
  expiresAt: number
  email?: string
}

export interface DriveAuthRecord {
  id: number
  accessToken: string
  refreshToken: string
  expiresAt: Date
  email: string | null
}

/**
 * Returns the single Drive connection row with its tokens opened, or null
 * when not connected (or its tokens can't be opened: sign in again).
 */
export async function getDriveAuth(): Promise<DriveAuthRecord | null> {
  const db = getDatabase()
  const [row] = await db.select().from(googleDriveAuth).limit(1)
  if (!row) return null
  const accessToken = openSecret(row.accessToken, secretPlaces.driveAccessToken)
  const refreshToken = openSecret(
    row.refreshToken,
    secretPlaces.driveRefreshToken,
  )
  if (accessToken === null || refreshToken === null) return null
  return { ...row, accessToken, refreshToken }
}

/** Upserts the single Drive connection row after a successful OAuth exchange. */
export async function storeDriveAuth(tokens: DriveTokens): Promise<void> {
  const db = getDatabase()
  const existing = await db.select().from(googleDriveAuth).limit(1)

  const values = {
    accessToken: sealSecret(tokens.accessToken, secretPlaces.driveAccessToken),
    refreshToken: sealSecret(
      tokens.refreshToken,
      secretPlaces.driveRefreshToken,
    ),
    expiresAt: new Date(tokens.expiresAt),
    email: tokens.email ?? null,
  }

  const [current] = existing
  if (current) {
    await db
      .update(googleDriveAuth)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(googleDriveAuth.id, current.id))
  } else {
    await db.insert(googleDriveAuth).values(values)
  }
}

/** Updates just the access token + expiry after a refresh. */
export async function updateDriveAccessToken(
  id: number,
  accessToken: string,
  expiresAt: Date,
): Promise<void> {
  const db = getDatabase()
  await db
    .update(googleDriveAuth)
    .set({
      accessToken: sealSecret(accessToken, secretPlaces.driveAccessToken),
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(googleDriveAuth.id, id))
}

/** Removes the Drive connection (on disconnect or when the refresh token dies). */
export async function clearDriveAuth(): Promise<void> {
  const db = getDatabase()
  await db.delete(googleDriveAuth)
}
