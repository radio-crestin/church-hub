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
  const logTiming = (label: string, start: number) => {
    // biome-ignore lint/suspicious/noConsole: Startup timing logs
    console.log(
      `[startup] ${label}: ${(performance.now() - start).toFixed(1)}ms`,
    )
  }

  log('info', 'Running Drizzle migrations...')

  // Use embedded migrations in Tauri production mode, otherwise use file-based
  let t = performance.now()
  if (IS_TAURI_PRODUCTION) {
    runEmbeddedMigrations(rawDb)
  } else {
    // Run Drizzle schema migrations from filesystem
    migrate(drizzleDb, { migrationsFolder: MIGRATIONS_FOLDER })
  }
  logTiming('drizzle_migrations', t)

  log('info', 'Drizzle migrations complete')

  // Create FTS virtual tables (Drizzle cannot manage these)
  log('info', 'Creating FTS tables...')
  t = performance.now()
  const ftsCreated = createFtsTables()
  logTiming('fts_tables', t)

  // Initialize presentation_state singleton row
  t = performance.now()
  initializePresentationState(rawDb)
  logTiming('init_presentation_state', t)

  // Seed system roles and permissions
  log('info', 'Seeding system roles...')
  t = performance.now()
  seedSystemRoles(rawDb)
  logTiming('seed_roles', t)

  // Seed default screens
  log('info', 'Seeding default screens...')
  t = performance.now()
  seedDefaultScreens(rawDb)
  logTiming('seed_screens', t)

  // Seed song categories (before songs, as songs reference categories)
  log('info', 'Seeding song categories...')
  t = performance.now()
  seedSongCategories(rawDb)
  logTiming('seed_song_categories', t)

  // Seed songs
  log('info', 'Seeding songs...')
  t = performance.now()
  seedSongs(rawDb)
  logTiming('seed_songs', t)

  // Seed bible translations metadata
  log('info', 'Seeding bible translations...')
  t = performance.now()
  seedBibleTranslations(rawDb)
  logTiming('seed_bible_translations', t)

  // Seed app settings (sidebar config, search synonyms, appearance, etc.)
  log('info', 'Seeding app settings...')
  t = performance.now()
  seedAppSettings(rawDb)
  logTiming('seed_app_settings', t)

  return { ftsRecreated: ftsCreated }
}

/**
 * Ensures the presentation_state singleton row exists
 */
function initializePresentationState(db: Database): void {
  db.run(
    'INSERT OR IGNORE INTO presentation_state (id, is_presenting) VALUES (1, 0)',
  )
}
