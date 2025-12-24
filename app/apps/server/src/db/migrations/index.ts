import { join } from 'node:path'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

import { EMBEDDED_MIGRATIONS } from './embedded'
import { seedSystemRoles } from './seed'
import { seedBibleTranslations } from './seed-bibles'
import { seedDefaultScreens } from './seed-screens'
import { seedAppSettings } from './seed-settings'
import { seedSongCategories } from './seed-song-categories'
import { seedSongs } from './seed-songs'
import type { Database } from 'bun:sqlite'
import { createFtsTables } from '../fts'

// Resolve migrations folder relative to this file (only used in dev mode)
const MIGRATIONS_FOLDER = join(import.meta.dir, '../../../drizzle/migrations')

// Check if running in Tauri production mode
const IS_TAURI_PRODUCTION = process.env.TAURI_MODE === 'true'

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
 * Runs embedded migrations for production builds
 * Uses the pre-generated SQL from embedded.ts
 */
function runEmbeddedMigrations(rawDb: Database): void {
  log('info', 'Running embedded migrations (production mode)...')

  // Create migrations table if not exists
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER
    )
  `)

  // Get already applied migrations
  const applied = new Set(
    rawDb
      .query<{ hash: string }, []>('SELECT hash FROM __drizzle_migrations')
      .all()
      .map((row) => row.hash),
  )

  // Apply each migration that hasn't been applied
  for (const migration of EMBEDDED_MIGRATIONS) {
    const hash = migration.tag
    if (applied.has(hash)) {
      log('debug', `Skipping already applied: ${migration.tag}`)
      continue
    }

    log('info', `Applying migration: ${migration.tag}`)

    // Split by statement breakpoint and execute each statement
    const statements = migration.sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const statement of statements) {
      rawDb.run(statement)
    }

    // Record migration as applied
    rawDb.run(
      'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      [hash, migration.when],
    )
  }

  log('info', 'Embedded migrations complete')
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

  // Use embedded migrations in Tauri production mode, otherwise use file-based
  if (IS_TAURI_PRODUCTION) {
    runEmbeddedMigrations(rawDb)
  } else {
    // Run Drizzle schema migrations from filesystem
    migrate(drizzleDb, { migrationsFolder: MIGRATIONS_FOLDER })
  }

  log('info', 'Drizzle migrations complete')

  // Create FTS virtual tables (Drizzle cannot manage these)
  log('info', 'Creating FTS tables...')
  createFtsTables()

  // Initialize presentation_state singleton row
  initializePresentationState(rawDb)

  // Seed system roles and permissions
  log('info', 'Seeding system roles...')
  seedSystemRoles(rawDb)

  // Seed default screens
  log('info', 'Seeding default screens...')
  seedDefaultScreens(rawDb)

  // Seed song categories (before songs, as songs reference categories)
  log('info', 'Seeding song categories...')
  seedSongCategories(rawDb)

  // Seed songs
  log('info', 'Seeding songs...')
  seedSongs(rawDb)

  // Seed bible translations metadata
  log('info', 'Seeding bible translations...')
  seedBibleTranslations(rawDb)

  // Seed app settings (sidebar config, search synonyms, appearance, etc.)
  log('info', 'Seeding app settings...')
  seedAppSettings(rawDb)

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
