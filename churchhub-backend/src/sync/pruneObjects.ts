import type { Bucket } from './createBucket'

/** Deletes per call, so one request stays well under subrequest limits. */
const MAX_DELETES = 200

/** The seq a `log/<seq>-…` or `snap/<seq>-…` key was written at. */
function seqOf(key: string): number | null {
  const match = key.match(/\/(log|snap)\/(\d+)-[^/]+$/)
  return match ? Number(match[2]) : null
}

/**
 * Deletes what readers no longer need under `prefix`: snapshots older than
 * `keepFrom`, and segments up to it (that snapshot holds them), lost
 * writes' segments included. The snapshot at `keepFrom` and the segments
 * after it stay, for a reader still holding the previous head.json. Returns
 * how many objects were deleted (the rest go next time).
 */
export async function pruneObjects(
  bucket: Bucket,
  prefix: string,
  keepFrom: number
): Promise<number> {
  const stale = (await bucket.list(`${prefix}/`)).filter((key) => {
    const seq = seqOf(key)
    if (seq === null) return false
    return key.includes('/snap/') ? seq < keepFrom : seq <= keepFrom
  })
  for (const key of stale.slice(0, MAX_DELETES)) await bucket.delete(key)
  return Math.min(stale.length, MAX_DELETES)
}
