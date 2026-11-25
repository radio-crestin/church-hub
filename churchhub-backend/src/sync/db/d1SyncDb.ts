import { drizzle } from 'drizzle-orm/d1'
import * as sqliteSchema from './sqliteSchema'
import type { SyncDb, SyncStatement } from './SyncDb'

/** Cloudflare D1 (migrations: migrations/sqlite, applied by wrangler). */
export function d1SyncDb(binding: D1Database): SyncDb {
  const q = drizzle(binding)
  return {
    dialect: 'sqlite',
    q,
    t: sqliteSchema,
    async atomic(build) {
      const statements = build(q)
      if (statements.length === 0) return
      await q.batch(statements as [SyncStatement, ...SyncStatement[]])
    },
    close: async () => {},
  }
}
