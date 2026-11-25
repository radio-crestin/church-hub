import { createBucket } from '../createBucket'
import { SyncError } from '../SyncError'
import type { Bindings } from '../../types'
import type { SyncStore } from './ChurchState'

/**
 * The service's storage from its settings: the public bucket, the bucket
 * the encrypted states go to (S3_STATE_BUCKET, else the same one) and
 * SYNC_SECRET. Missing any, /sync answers 503 not_configured.
 */
export function createSyncStore(env: Bindings): SyncStore {
  if (!env.SYNC_SECRET) {
    throw new SyncError(503, 'not_configured', 'Cloud sync is not configured')
  }
  return {
    bucket: createBucket(env),
    states: createBucket(env, env.S3_STATE_BUCKET || env.S3_BUCKET),
    secret: env.SYNC_SECRET,
  }
}
