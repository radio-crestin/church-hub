/**
 * Checks that the sync buckets honour the conditional writes cloud sync
 * relies on (README "Cloud sync"), with the same S3_* settings as the
 * service. Writes and deletes one object under `probe/` in each bucket.
 *
 *   S3_ENDPOINT=… S3_REGION=… S3_BUCKET=… [S3_STATE_BUCKET=…] \
 *   S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… S3_PUBLIC_URL=… \
 *     bun scripts/probeConditionalWrites.ts
 *
 * Exits 1 when a write that must be refused (412) was accepted.
 */
import { probeConditionalWrites, syncBuckets } from '../src/sync/probeConditionalWrites'
import type { Bindings } from '../src/types'

const env = process.env as unknown as Bindings
let failed = false
for (const name of syncBuckets(env)) {
  const failures = await probeConditionalWrites(env, name)
  failed ||= failures.length > 0
  console.log(
    failures.length
      ? `FAIL ${name}: ${failures.join('; ')}`
      : `OK   ${name}: conditional writes honoured`
  )
}
process.exit(failed ? 1 : 0)
