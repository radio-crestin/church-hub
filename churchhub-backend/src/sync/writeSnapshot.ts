import type { Bucket } from './createBucket'
import { gzipJson } from './gzipJson'
import { randomId } from './randomId'
import type { Snapshot } from './types'

/** Segments and snapshots never change once written: cached for a year. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** Writes `snap/<seq>-<nonce>.json.gz` under `prefix`; returns its relative key. */
export async function writeSnapshot(
  bucket: Bucket,
  prefix: string,
  snapshot: Snapshot
): Promise<string> {
  const key = `snap/${snapshot.seq}-${randomId(6)}.json.gz`
  await bucket.put(`${prefix}/${key}`, await gzipJson(snapshot), {
    contentType: 'application/gzip',
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  })
  return key
}
