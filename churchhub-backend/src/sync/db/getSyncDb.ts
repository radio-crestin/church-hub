import { SyncError } from '../SyncError'
import type { Bindings } from '../../types'
import { d1SyncDb } from './d1SyncDb'
import { postgresSyncDb } from './postgresSyncDb'
import type { SyncDb } from './SyncDb'

/**
 * This request's central state, from the Worker's bindings: the D1 database
 * `SYNC_DB`, or Postgres through the Hyperdrive binding `SYNC_HYPERDRIVE` or
 * the `SYNC_DATABASE_URL` secret. The caller closes it after the response.
 */
export function getSyncDb(env: Bindings): SyncDb {
  if (env.SYNC_DB) return d1SyncDb(env.SYNC_DB)
  const url = env.SYNC_HYPERDRIVE?.connectionString ?? env.SYNC_DATABASE_URL
  if (url) return postgresSyncDb(url)
  throw new SyncError(
    503,
    'not_configured',
    'Cloud sync database is not configured'
  )
}
