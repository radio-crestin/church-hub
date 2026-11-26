import type { Bindings, SyncReadiness } from '../types'
import { probeConditionalWrites, syncBuckets } from '../sync/probeConditionalWrites'

/**
 * Probes the sync buckets for conditional writes once at startup and hands
 * out the bindings each request runs with: until the probe passes (or for
 * good, if it fails) they lack SYNC_SECRET, and SYNC_READINESS tells
 * /health/ready where the probe stands, so /sync answers its own 503
 * not_configured (CORS and all), and a store that would let concurrent
 * writers overwrite each other is never written to.
 */
export function createSyncGuard(env: Bindings): () => Bindings {
  const buckets = syncBuckets(env)
  if (!env.SYNC_SECRET || !env.S3_ENDPOINT || buckets.length === 0) {
    const off: Bindings = { ...env, SYNC_READINESS: 'off' }
    return () => off
  }
  let readiness: SyncReadiness = 'starting'
  Promise.all(buckets.map((name) => probeConditionalWrites(env, name)))
    .then((results) => {
      const failures = results.flat()
      readiness = failures.length === 0 ? 'enabled' : 'disabled'
      if (readiness === 'enabled') console.log('[sync] conditional writes verified')
      else console.error(`[sync] the bucket refuses safe writes, sync disabled: ${failures.join('; ')}`)
    })
    .catch((error: Error) => {
      readiness = 'disabled'
      console.error('[sync] conditional-write probe failed, sync disabled:', error.message)
    })
  return () =>
    readiness === 'enabled'
      ? { ...env, SYNC_READINESS: readiness }
      : { ...env, SYNC_SECRET: undefined, SYNC_READINESS: readiness }
}
