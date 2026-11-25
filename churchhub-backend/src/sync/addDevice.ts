import { and, eq } from 'drizzle-orm'
import { createDeviceToken } from './createDeviceToken'
import type { SyncDb } from './db/SyncDb'
import { randomId } from './randomId'
import { SyncError } from './SyncError'

/**
 * Mints a device token bound to one of the church's users, so that user's
 * permissions apply to everything the device writes. The token is returned
 * once; only its hash is kept.
 */
export async function addDevice(
  db: SyncDb,
  tokenSecret: string,
  churchId: string,
  input: { userId: string; name: string }
): Promise<{ deviceId: string; token: string }> {
  const { devices, users } = db.t
  const [user] = await db.q
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.churchId, churchId), eq(users.id, input.userId)))
  if (!user) {
    throw new SyncError(400, 'unknown_user', 'No such user in this church')
  }

  const deviceId = randomId(12)
  const { token, tokenHash } = await createDeviceToken(tokenSecret)
  await db.q.insert(devices).values({
    id: deviceId,
    churchId,
    tokenHash,
    userId: user.id,
    name: input.name,
    createdAt: Math.floor(Date.now() / 1000),
  })
  return { deviceId, token }
}
