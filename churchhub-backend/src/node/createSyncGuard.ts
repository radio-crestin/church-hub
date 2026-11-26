import type { Bindings } from '../types'
import { probeConditionalWrites, syncBuckets } from '../sync/probeConditionalWrites'

/**
 * Probes the sync buckets for conditional writes once at startup and hands
 * out the bindings each request runs with: until the probe passes (or for
 * good, if it fails) they lack SYNC_SECRET, so /sync answers its own 503
 * not_configured (CORS and all), and a store that would let concurrent
 * writers overwrite each other is never written to.
 */
export function createSyncGuard(env: Bindings): () => Bindings {
  const withoutSync: Bindings = { ...env, SYNC_SECRET: undefined }
  const buckets = syncBuckets(env)
  if (!env.SYNC_SECRET || !env.S3_ENDPOINT || buckets.length === 0) {
    return () => env
  }
  let verified = false
  Promise.all(buckets.map((name) => probeConditionalWrites(env, name)))
    .then((results) => {
      const failures = results.flat()
      verified = failures.length === 0
      if (verified) console.log('[sync] conditional writes verified')
      else console.error(`[sync] the bucket refuses safe writes, sync disabled: ${failures.join('; ')}`)
    })
    .catch((error: Error) =>
      console.error('[sync] conditional-write probe failed, sync disabled:', error.message)
    )
  return () => (verified ? env : withoutSync)
}
