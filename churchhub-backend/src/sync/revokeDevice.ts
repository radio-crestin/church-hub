import { and, eq, isNull } from 'drizzle-orm'
import type { Bucket } from './createBucket'
import type { SyncDb } from './getSyncDb'
import { rotatePath } from './rotatePath'
import { devices } from './schema'
import { SyncError } from './SyncError'

/**
 * Revokes a device: its writes are refused from the next request, and the
 * path secret rotates, since the device still knows the old read path.
 * The church server's own token is not revoked this way (T-172: recovery).
 * Returns the new path secret.
 */
export async function revokeDevice(
  db: SyncDb,
  bucket: Bucket,
  churchId: string,
  deviceId: string
): Promise<string> {
  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.churchId, churchId),
        eq(devices.id, deviceId),
        isNull(devices.revokedAt)
      )
    )
  if (!device) throw new SyncError(404, 'not_found', 'No such device')
  if (device.isServer) {
    throw new SyncError(400, 'server_device', 'The church server cannot be revoked')
  }

  await db
    .update(devices)
    .set({ revokedAt: Math.floor(Date.now() / 1000) })
    .where(eq(devices.id, device.id))
  return rotatePath(db, bucket, churchId)
}
