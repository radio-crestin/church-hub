// biome-ignore-all lint/correctness/noUndeclaredDependencies: the spike sits outside the workspaces and uses app/node_modules
/**
 * Stands in for `apps/server/src/db/connection.ts` in the browser build (the
 * Vite config redirects that one file here): the same exports, opening the
 * OPFS database through the bun:sqlite shim, then the server's own
 * `runMigrations`. Nothing else in the server is replaced.
 */
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite'

import { Database } from './bunSqliteShim'
import {
  type MigrationResult,
  runMigrations,
} from '../../../../apps/server/src/db/migrations'
import * as schema from '../../../../apps/server/src/db/schema'

let sqlite: Database | null = null
let extraPragmas: string[] = []
let db: BunSQLiteDatabase<typeof schema> | null = null

/** Pragmas the bench tries on top of the defaults (journal, synchronous). */
export function configurePragmas(pragmas: string[]): void {
  extraPragmas = pragmas
}

/** The server's pragmas that mean something on OPFS (no WAL, no mmap there). */
function applyPragmas(connection: Database): void {
  connection.run('PRAGMA journal_mode = TRUNCATE')
  connection.run('PRAGMA foreign_keys = ON')
  connection.run('PRAGMA cache_size = -16384')
  connection.run('PRAGMA temp_store = MEMORY')
  connection.run('PRAGMA synchronous = NORMAL')
  for (const pragma of extraPragmas) connection.run(`PRAGMA ${pragma}`)
}

export async function initializeDatabase(): Promise<{
  db: BunSQLiteDatabase<typeof schema>
  migrationResult: MigrationResult
}> {
  connectDatabase()
  const migrationResult = runMigrations(db as never, sqlite as never)
  return { db: db as BunSQLiteDatabase<typeof schema>, migrationResult }
}

export function connectDatabase(): void {
  sqlite = new Database('/church-hub.db')
  applyPragmas(sqlite)
  db = drizzle(sqlite as never, { schema })
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
