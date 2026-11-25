import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as postgresSchema from './postgresSchema'
import type { SyncDb, SyncQuery, SyncTables } from './SyncDb'

/**
 * Any PostgreSQL server, through postgres.js (Bun, Node, and Workers with
 * nodejs_compat, directly or through Hyperdrive). Migrations:
 * migrations/postgresql.
 */
export function postgresSyncDb(url: string, maxConnections = 10): SyncDb {
  // No custom types to look up: one round trip less per connection.
  const client = postgres(url, {
    max: maxConnections,
    fetch_types: false,
    onnotice: () => {},
  })
  const db = drizzle(client)
  // Same tables and builder API as SQLite's (SyncDb.ts), so typed as those.
  const q = db as unknown as SyncQuery
  return {
    dialect: 'postgresql',
    q,
    t: postgresSchema as unknown as SyncTables,
    async atomic(build) {
      await db.transaction(async (tx) => {
        for (const statement of build(tx as unknown as SyncQuery)) {
          await statement
        }
      })
    },
    close: () => client.end(),
  }
}
