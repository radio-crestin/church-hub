import { join } from 'node:path'
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite'

import { Database } from 'bun:sqlite'
import { mock } from 'bun:test'
import * as schema from '../../db/schema'

const CONNECTION_MODULE = join(import.meta.dir, '../../db/connection.ts')

/**
 * Points the app's database connection at a fresh in-memory SQLite database
 * with every migration and seed applied, exactly like a first launch.
 *
 * The connection module is mocked instead of calling `initializeDatabase`:
 * that reads DATABASE_PATH once at import time, and the server `.env` points
 * it at the developer's real database — which a test must never open. Bun
 * shares modules between test files, so the mock also rebinds services that
 * another file already imported.
 */
export async function createMigratedTestDatabase(): Promise<{
  db: BunSQLiteDatabase<typeof schema>
  sqlite: Database
}> {
  const sqlite = new Database(':memory:')
  sqlite.run('PRAGMA foreign_keys = ON')
  const db = drizzle(sqlite, { schema })

  mock.module(CONNECTION_MODULE, () => ({
    initializeDatabase: () => {
      throw new Error('Tests use createMigratedTestDatabase()')
    },
    getDatabase: () => db,
    getRawDatabase: () => sqlite,
    closeDatabase: () => sqlite.close(),
  }))

  const { runMigrations } = await import('../../db/migrations')
  runMigrations(db as unknown as BunSQLiteDatabase, sqlite)

  return { db, sqlite }
}
