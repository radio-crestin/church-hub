import { and, asc, eq, gt } from 'drizzle-orm'
import { churchPrefix } from './churchPrefix'
import type { Bucket } from './createBucket'
import type { SyncDb } from './getSyncDb'
import { bucketObjects, churches } from './schema'
import type { Head } from './types'

/** Readers revalidate head.json on every poll (an unchanged one is a 304). */
export const HEAD_CACHE_CONTROL = 'no-cache'

/**
 * Writes head.json from the central state: the snapshot and the segments
 * after it. Two writers may PUT out of order, so each re-reads the state
 * after its PUT and writes again until what it wrote is the newest: the last
 * one standing always leaves the current head.
 */
export async function publishHead(
  db: SyncDb,
  bucket: Bucket,
  churchId: string
): Promise<Head> {
  for (;;) {
    const [church] = await db
      .select()
      .from(churches)
      .where(eq(churches.id, churchId))
    const segments = await db
      .select({ seq: bucketObjects.seq, key: bucketObjects.key })
      .from(bucketObjects)
      .where(
        and(
          eq(bucketObjects.churchId, churchId),
          eq(bucketObjects.kind, 'log'),
          gt(bucketObjects.seq, church.snapshotSeq)
        )
      )
      .orderBy(asc(bucketObjects.seq))
    const head: Head = {
      schemaVersion: 1,
      seq: church.seq,
      snapshot: church.snapshotKey
        ? { seq: church.snapshotSeq, key: church.snapshotKey }
        : null,
      segments,
    }
    const prefix = churchPrefix(church.id, church.pathSecret)
    await bucket.put(
      `${prefix}/head.json`,
      new TextEncoder().encode(JSON.stringify(head)),
      { contentType: 'application/json', cacheControl: HEAD_CACHE_CONTROL }
    )

    const [after] = await db
      .select({ seq: churches.seq, pathSecret: churches.pathSecret })
      .from(churches)
      .where(eq(churches.id, churchId))
    if (after.seq === church.seq && after.pathSecret === church.pathSecret) {
      return head
    }
  }
}
