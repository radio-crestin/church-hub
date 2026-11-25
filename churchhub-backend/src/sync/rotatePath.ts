import { and, eq, lte } from 'drizzle-orm'
import { churchPrefix } from './churchPrefix'
import type { Bucket } from './createBucket'
import type { SyncDb } from './getSyncDb'
import { loadLibrary } from './loadLibrary'
import { publishHead } from './publishHead'
import { randomId } from './randomId'
import { bucketObjects, churches } from './schema'
import { SyncError } from './SyncError'
import { writeSnapshot } from './writeSnapshot'

const MAX_ATTEMPTS = 5

/**
 * Moves the church to a fresh path secret, so a revoked device that still
 * knows the old path reads nothing new: the whole library is written as one
 * snapshot under the new prefix, the central state switches to it, then
 * every object under the old prefix is deleted. Remaining devices learn the
 * new path from their next write or `GET path`. Returns the new secret.
 */
export async function rotatePath(
  db: SyncDb,
  bucket: Bucket,
  churchId: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [church] = await db
      .select()
      .from(churches)
      .where(eq(churches.id, churchId))
    const snapshot = await loadLibrary(db, bucket, church)
    const pathSecret = randomId(32)
    const prefix = churchPrefix(church.id, pathSecret)
    const key = await writeSnapshot(bucket, prefix, {
      ...snapshot,
      seq: church.seq,
    })
    const oldObjects = await db
      .select({ key: bucketObjects.key })
      .from(bucketObjects)
      .where(eq(bucketObjects.churchId, church.id))

    await db.batch([
      db
        .update(churches)
        .set({
          pathSecret,
          snapshotSeq: church.seq,
          snapshotKey: key,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(
          and(
            eq(churches.id, church.id),
            eq(churches.seq, church.seq),
            eq(churches.pathSecret, church.pathSecret)
          )
        ),
    ])
    const [after] = await db
      .select({ pathSecret: churches.pathSecret })
      .from(churches)
      .where(eq(churches.id, church.id))
    if (after.pathSecret !== pathSecret) {
      // A write landed meanwhile: its segment is missing from this snapshot.
      await bucket.delete(`${prefix}/${key}`)
      continue
    }

    await db.batch([
      // Only the old prefix's rows: a write may already have landed under
      // the new one, with a later seq.
      db
        .delete(bucketObjects)
        .where(
          and(
            eq(bucketObjects.churchId, church.id),
            lte(bucketObjects.seq, church.seq)
          )
        ),
      db
        .insert(bucketObjects)
        .values({ churchId: church.id, key, kind: 'snap', seq: church.seq }),
    ])
    await publishHead(db, bucket, church.id)

    const oldPrefix = churchPrefix(church.id, church.pathSecret)
    for (const object of [{ key: 'head.json' }, ...oldObjects]) {
      await bucket.delete(`${oldPrefix}/${object.key}`)
    }
    return pathSecret
  }
  throw new SyncError(503, 'busy', 'Too many concurrent writes, try again')
}
