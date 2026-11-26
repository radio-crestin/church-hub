/**
 * `db/connection.ts` in the browser build: the same exports, on the
 * bun:sqlite shim (memory or OPFS, as the worker set it: worker/database.ts),
 * with the pragmas that mean something there (no WAL or mmap on OPFS), then
 * the server's own migrations and acting-user stamps.
 */
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite'

import { Database } from './bunSqlite'
import { stampActingUser } from '../../../../../../server/src/db/actingUser'
import {
  type MigrationResult,
  runMigrations,
} from '../../../../../../server/src/db/migrations'
import * as schema from '../../../../../../server/src/db/schema'

let sqlite: Database | null = null
let db: BunSQLiteDatabase<typeof schema> | null = null

function applyPragmas(connection: Database): void {
  connection.run('PRAGMA journal_mode = TRUNCATE')
  connection.run('PRAGMA foreign_keys = ON')
  connection.run('PRAGMA cache_size = -16384')
  connection.run('PRAGMA temp_store = MEMORY')
  connection.run('PRAGMA synchronous = NORMAL')
}

export function connectDatabase(): void {
  sqlite = new Database('app.db')
  applyPragmas(sqlite)
  stampActingUser(sqlite as never)
  db = drizzle(sqlite as never, { schema })
}

export async function initializeDatabase(): Promise<{
  db: BunSQLiteDatabase<typeof schema>
  migrationResult: MigrationResult
}> {
  sqlite = new Database('app.db')
  applyPragmas(sqlite)
  db = drizzle(sqlite as never, { schema })
  const migrationResult = runMigrations(sqlite as never)
  stampActingUser(sqlite as never)
  return { db, migrationResult }
}

export function getDatabase(): BunSQLiteDatabase<typeof schema> {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getRawDatabase(): Database {
  if (!sqlite) throw new Error('Database not initialized')
  return sqlite
}

export function closeDatabase(): void {
  sqlite?.close()
  sqlite = null
  db = null
}
