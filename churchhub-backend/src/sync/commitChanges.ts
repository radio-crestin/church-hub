import { and, count, eq, gt, sql } from 'drizzle-orm'
import { checkChanges } from './checkChanges'
import { churchPrefix } from './churchPrefix'
import { compact } from './compact'
import type { Bucket } from './createBucket'
import type { SyncDb } from './db/SyncDb'
import { gzipJson } from './gzipJson'
import { loadEntityVersions } from './loadEntityVersions'
import { loadPermissions } from './loadPermissions'
import { publishHead } from './publishHead'
import { randomId } from './randomId'
import { SyncError } from './SyncError'
import type { ChangeInput, PublishedChange, Segment, SyncCaller } from './types'
import { IMMUTABLE_CACHE_CONTROL } from './writeSnapshot'

/** A write that keeps losing the race for the next seq gives up (503). */
const MAX_ATTEMPTS = 8

/** Waits a random, growing while, so racing writers stop colliding. */
function backOff(attempt: number): Promise<void> {
  const ms = (attempt + 1) * (20 + Math.random() * 80)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface CommitResult {
  seq: number
  versions: { type: string; uuid: string; version: number }[]
}

async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value))
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

/**
 * One accepted write (design §4): authorize every change, check its version,
 * then publish it as one segment and commit the new versions.
 *
 * The segment is written first, under a name of its own
 * (`log/<seq>-<nonce>.json.gz`); the commit then claims `seq` in one
 * transaction whose every statement runs only if the claim was this
 * commit's. A commit that lost the claim deletes its segment and starts
 * again, re-checking versions against the winner's.
 */
export async function commitChanges(
  db: SyncDb,
  bucket: Bucket,
  caller: SyncCaller,
  changes: ChangeInput[],
  compactAfter: number
): Promise<CommitResult> {
  const { bucketObjects, churches, entities } = db.t
  const granted = await loadPermissions(db, caller)
  const hashes = await Promise.all(
    changes.map((change) => (change.data ? sha256(change.data) : null))
  )

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [church] = await db.q
      .select()
      .from(churches)
      .where(eq(churches.id, caller.churchId))
    try {
      checkChanges(
        changes,
        await loadEntityVersions(db, church.id, changes),
        granted
      )
    } catch (error) {
      // A client stuck on a stale head (a head write that failed) is told
      // about the conflict and gets the current head on its next poll.
      if (error instanceof SyncError && error.status === 409) {
        await publishHead(db, bucket, church.id)
      }
      throw error
    }

    const seq = church.seq + 1
    const nonce = randomId(9)
    const now = Math.floor(Date.now() / 1000)
    const published: PublishedChange[] = changes.map((change) => ({
      type: change.type,
      uuid: change.uuid,
      op: change.op,
      version: seq,
      ...(change.op === 'upsert'
        ? { data: change.data }
        : { deletedAt: change.deletedAt }),
    }))
    const segment: Segment = {
      seq,
      committedAt: now,
      deviceId: caller.deviceId,
      userId: caller.userId,
      changes: published,
    }
    const key = `log/${seq}-${nonce}.json.gz`
    const prefix = churchPrefix(church.id, church.pathSecret)
    await bucket.put(`${prefix}/${key}`, await gzipJson(segment), {
      contentType: 'application/gzip',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    })

    // Inserts guarded by the claim: they add rows only if this commit's
    // UPDATE took `seq`. Standard SQL (CAST, excluded.) runs on every dialect.
    const text = (value: string | null) => sql`CAST(${value} AS text)`
    const ours = sql`FROM ${churches} WHERE ${churches.id} = ${church.id}
      AND ${churches.commitNonce} = ${nonce}`
    try {
      await db.atomic((q) => [
        q
          .update(churches)
          .set({ seq, commitNonce: nonce, updatedAt: now })
          .where(
            and(
              eq(churches.id, church.id),
              eq(churches.seq, church.seq),
              eq(churches.pathSecret, church.pathSecret)
            )
          ),
        q.insert(bucketObjects).select(
          sql`SELECT ${text(church.id)}, ${text(key)}, ${text('log')},
              CAST(${seq} AS integer) ${ours}`
        ),
        ...changes.map((change, index) =>
          q
            .insert(entities)
            .select(
              sql`SELECT ${text(church.id)}, ${text(change.type)},
                ${text(change.uuid)}, CAST(${seq} AS integer),
                CAST(${change.op === 'delete' ? 1 : 0} AS boolean),
                ${text(hashes[index])}, ${text(caller.userId)},
                ${text(caller.userId)}, CAST(${now} AS bigint) ${ours}`
            )
            .onConflictDoUpdate({
              target: [entities.churchId, entities.type, entities.uuid],
              set: {
                version: sql`excluded.version`,
                deleted: sql`excluded.deleted`,
                contentHash: sql`excluded.content_hash`,
                updatedBy: sql`excluded.updated_by`,
                updatedAt: sql`excluded.updated_at`,
              },
            })
        ),
      ])
    } catch (error) {
      await bucket.delete(`${prefix}/${key}`)
      throw error
    }

    // The segment's row exists only if this commit's claim held (a later
    // commit may already have replaced commit_nonce).
    const [claimed] = await db.q
      .select({ key: bucketObjects.key })
      .from(bucketObjects)
      .where(
        and(eq(bucketObjects.churchId, church.id), eq(bucketObjects.key, key))
      )
    if (!claimed) {
      await bucket.delete(`${prefix}/${key}`)
      await backOff(attempt)
      continue
    }

    await publishHead(db, bucket, church.id)
    const [pending] = await db.q
      .select({ segments: count() })
      .from(bucketObjects)
      .where(
        and(
          eq(bucketObjects.churchId, church.id),
          eq(bucketObjects.kind, 'log'),
          gt(bucketObjects.seq, church.snapshotSeq)
        )
      )
    if (pending.segments >= compactAfter) {
      await compact(db, bucket, church.id)
    }

    return {
      seq,
      versions: changes.map(({ type, uuid }) => ({ type, uuid, version: seq })),
    }
  }
  throw new SyncError(503, 'busy', 'Too many concurrent writes, try again')
}
