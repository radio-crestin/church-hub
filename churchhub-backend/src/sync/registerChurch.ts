import { churchPrefix } from './churchPrefix'
import type { Bucket } from './createBucket'
import { createDeviceToken } from './createDeviceToken'
import type { SyncDb } from './getSyncDb'
import { publishHead } from './publishHead'
import { randomId } from './randomId'
import { churches, devices } from './schema'

export interface RegisteredChurch {
  churchId: string
  pathSecret: string
  /** Public base URL of the church's prefix: readers GET `<readUrl>/head.json`. */
  readUrl: string
  deviceId: string
  /** The church server's token; shown once, only its hash is kept. */
  serverToken: string
}

/**
 * Registers a church server as a guest (no owner yet, T-172 adds Google
 * sign-in): a church id, a 256-bit path secret, the server's device token,
 * and an empty head.json readers can poll at once.
 */
export async function registerChurch(
  db: SyncDb,
  bucket: Bucket,
  tokenSecret: string,
  serverName: string
): Promise<RegisteredChurch> {
  const churchId = randomId(12)
  const pathSecret = randomId(32)
  const deviceId = randomId(12)
  const { token, tokenHash } = await createDeviceToken(tokenSecret)
  const now = Math.floor(Date.now() / 1000)

  await db.batch([
    db.insert(churches).values({
      id: churchId,
      pathSecret,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(devices).values({
      id: deviceId,
      churchId,
      tokenHash,
      name: serverName,
      isServer: true,
      createdAt: now,
    }),
  ])
  await publishHead(db, bucket, churchId)

  return {
    churchId,
    pathSecret,
    readUrl: bucket.publicUrl(churchPrefix(churchId, pathSecret)),
    deviceId,
    serverToken: token,
  }
}
