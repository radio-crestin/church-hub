import { join } from 'node:path'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

import { seedSystemRoles } from './seed'
import type { Database } from 'bun:sqlite'
import { createFtsTables } from '../fts'

// Resolve migrations folder relative to this file
const MIGRATIONS_FOLDER = join(import.meta.dir, '../../../drizzle/migrations')

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrations:${level}] ${message}`)
}

export interface MigrationResult {
  ftsRecreated?: boolean
}

/**
 * Runs all database migrations using Drizzle
 * Also handles FTS tables and seed data which Drizzle cannot manage
 */
export function runMigrations(
  drizzleDb: BunSQLiteDatabase,
  rawDb: Database,
): MigrationResult {
  log('info', 'Running Drizzle migrations...')

  // Run Drizzle schema migrations
  migrate(drizzleDb, { migrationsFolder: MIGRATIONS_FOLDER })

  log('info', 'Drizzle migrations complete')

  // Create FTS virtual tables (Drizzle cannot manage these)
  log('info', 'Creating FTS tables...')
  createFtsTables()

  // Initialize presentation_state singleton row
  initializePresentationState(rawDb)

  // Seed system roles and permissions
  log('info', 'Seeding system roles...')
  seedSystemRoles(rawDb)

  return { ftsRecreated: true }
}

/**
 * Ensures the presentation_state singleton row exists
 */
function initializePresentationState(db: Database): void {
  db.run(
    'INSERT OR IGNORE INTO presentation_state (id, is_presenting) VALUES (1, 0)',
  )
}
