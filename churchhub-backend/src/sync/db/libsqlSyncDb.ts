import type { Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as sqliteSchema from './sqliteSchema'
import type { SyncDb, SyncStatement } from './SyncDb'

/**
 * SQLite through libsql: a local file (`file:sync.db`), Turso or sqld.
 * Migrations: migrations/sqlite.
 */
export function libsqlSyncDb(client: Client): SyncDb {
  const q = drizzle(client)
  return {
    dialect: 'sqlite',
    q,
    t: sqliteSchema,
    async atomic(build) {
      const statements = build(q)
      if (statements.length === 0) return
      await q.batch(statements as [SyncStatement, ...SyncStatement[]])
    },
    close: async () => client.close(),
  }
}
