import { createBucket } from './createBucket'
import type { Bindings } from '../types'

const OPTIONS = { contentType: 'text/plain', cacheControl: 'no-store' }
const bytes = (text: string) => new TextEncoder().encode(text)

/**
 * The conditional writes cloud sync relies on, tried on one bucket: a new
 * key with `If-None-Match: *` is written, the same again is refused (412),
 * a stale `If-Match` is refused, the current one is accepted. Uses one
 * object under `probe/`, deleted afterwards. Returns what went wrong.
 */
export async function probeConditionalWrites(
  env: Bindings,
  bucketName: string
): Promise<string[]> {
  const bucket = createBucket(env, bucketName)
  const key = `probe/conditional-writes-${crypto.randomUUID()}.txt`
  const failures: string[] = []
  try {
    const first = await bucket.put(key, bytes('1'), { ...OPTIONS, ifNoneMatch: '*' })
    if (!first) failures.push('If-None-Match: * refused a new key')
    if (await bucket.put(key, bytes('2'), { ...OPTIONS, ifNoneMatch: '*' })) {
      failures.push('If-None-Match: * overwrote an existing key')
    }
    if (await bucket.put(key, bytes('3'), { ...OPTIONS, ifMatch: '"0000"' })) {
      failures.push('If-Match accepted a wrong ETag')
    }
    if (first && !(await bucket.put(key, bytes('4'), { ...OPTIONS, ifMatch: first }))) {
      failures.push('If-Match refused the current ETag')
    }
  } finally {
    await bucket.delete(key)
  }
  return failures
}

/** The buckets sync writes with conditions: the public one and the state one. */
export function syncBuckets(env: Bindings): string[] {
  return [...new Set([env.S3_BUCKET, env.S3_STATE_BUCKET])].filter(
    (name): name is string => Boolean(name)
  )
}
