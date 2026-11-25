import { createClient } from '@libsql/client'
import { libsqlSyncDb } from '../sync/db/libsqlSyncDb'
import { postgresSyncDb } from '../sync/db/postgresSyncDb'
import type { SyncDb } from '../sync/db/SyncDb'

/**
 * The self-hosted service's database, by URL: `postgres://…` for any
 * PostgreSQL server; otherwise SQLite through libsql: `file:sync.db`, or a
 * Turso / sqld URL (`libsql://…`) with its auth token. `maxConnections`:
 * the Postgres pool's size (a small plan may allow only a few).
 */
export function openSyncDb(options: {
  url: string
  authToken?: string
  maxConnections?: number
}): SyncDb {
  if (/^postgres(ql)?:\/\//i.test(options.url)) {
    return postgresSyncDb(options.url, options.maxConnections)
  }
  return libsqlSyncDb(
    createClient({ url: options.url, authToken: options.authToken })
  )
}
