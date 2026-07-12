import { eq } from 'drizzle-orm'

import type { DriveTokens } from './oauth/exchangeDriveCode'
import { getDatabase } from '../../db'
import { googleDriveAuth } from '../../db/schema'

export interface DriveAuthRecord {
  id: number
  accessToken: string
  refreshToken: string
  expiresAt: Date
  email: string | null
}

/** Returns the single Drive connection row, or null when not connected. */
export async function getDriveAuth(): Promise<DriveAuthRecord | null> {
  const db = getDatabase()
  const rows = await db.select().from(googleDriveAuth).limit(1)
  return rows[0] ?? null
}

/** Upserts the single Drive connection row after a successful OAuth exchange. */
export async function storeDriveAuth(tokens: DriveTokens): Promise<void> {
  const db = getDatabase()
  const existing = await db.select().from(googleDriveAuth).limit(1)

  const values = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: new Date(tokens.expiresAt),
    email: tokens.email ?? null,
  }

  if (existing.length > 0) {
    await db
      .update(googleDriveAuth)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(googleDriveAuth.id, existing[0].id))
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
    .set({ accessToken, expiresAt, updatedAt: new Date() })
    .where(eq(googleDriveAuth.id, id))
}

/** Removes the Drive connection (on disconnect or when the refresh token dies). */
export async function clearDriveAuth(): Promise<void> {
  const db = getDatabase()
  await db.delete(googleDriveAuth)
}
