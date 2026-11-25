import { and, eq, lt } from 'drizzle-orm'
import { churchPrefix } from './churchPrefix'
import type { Bucket } from './createBucket'
import type { SyncDb } from './getSyncDb'
import { loadLibrary } from './loadLibrary'
import { publishHead } from './publishHead'
import { bucketObjects, churches } from './schema'
import { writeSnapshot } from './writeSnapshot'

/**
 * Writes a snapshot of the whole library at the latest segment and points
 * head.json at it, so a new device downloads one file instead of every
 * segment. The segments it replaces stay until the bucket's lifecycle rule
 * expires them (a reader may be fetching them right now). Returns the
 * snapshot's seq.
 */
export async function compact(
  db: SyncDb,
  bucket: Bucket,
  churchId: string
): Promise<number> {
  const [church] = await db
    .select()
    .from(churches)
    .where(eq(churches.id, churchId))
  if (church.seq === church.snapshotSeq) return church.snapshotSeq

  const snapshot = await loadLibrary(db, bucket, church)
  const prefix = churchPrefix(church.id, church.pathSecret)
  const key = await writeSnapshot(bucket, prefix, snapshot)
  await db.batch([
    db
      .update(churches)
      .set({
        snapshotSeq: snapshot.seq,
        snapshotKey: key,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(
        and(
          eq(churches.id, church.id),
          eq(churches.pathSecret, church.pathSecret),
          lt(churches.snapshotSeq, snapshot.seq)
        )
      ),
    db
      .insert(bucketObjects)
      .values({ churchId, key, kind: 'snap', seq: snapshot.seq }),
  ])
  await publishHead(db, bucket, churchId)
  return snapshot.seq
}
