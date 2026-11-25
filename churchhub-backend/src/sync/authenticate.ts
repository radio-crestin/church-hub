import { and, eq, isNull } from 'drizzle-orm'
import type { SyncDb } from './getSyncDb'
import { hashToken } from './hashToken'
import { devices } from './schema'
import { SyncError } from './SyncError'
import type { SyncCaller } from './types'

/**
 * Finds the device behind a `Bearer` token of `churchId`. A revoked device,
 * another church's token or none at all are refused alike (401). The church
 * server (the PC) may name the user a change was made by (`actingUserId`):
 * it already logged that user in, and the check then applies to them.
 */
export async function authenticate(
  db: SyncDb,
  tokenSecret: string | undefined,
  churchId: string,
  authorization: string | undefined,
  actingUserId?: string | null
): Promise<SyncCaller> {
  if (!tokenSecret) {
    throw new SyncError(503, 'not_configured', 'Cloud sync is not configured')
  }
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) throw new SyncError(401, 'unauthorized', 'Missing token')

  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.tokenHash, await hashToken(token, tokenSecret)),
        eq(devices.churchId, churchId),
        isNull(devices.revokedAt)
      )
    )
    .limit(1)
  if (!device) throw new SyncError(401, 'unauthorized', 'Invalid token')

  return {
    churchId,
    deviceId: device.id,
    isServer: device.isServer,
    userId: device.isServer ? (actingUserId ?? null) : device.userId,
  }
}
