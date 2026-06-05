import { join } from 'node:path'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'

import { addCloseOnEscape } from './add-close-on-escape'
import { addLastPresentedAt } from './add-last-presented-at'
import { addPreviewScreen } from './add-preview-screen'
import { addSongGroups } from './add-song-groups'
import { addSongVersionsPermissions } from './add-song-versions-permissions'
import { addUserAuthFields } from './add-user-auth-fields'
import { dropSongKeyColumn } from './drop-song-key-column'
import { EMBEDDED_MIGRATIONS } from './embedded'
import { extractKeylinesFromSlides } from './extract-keylines-from-slides'
import { migrateMidiDeviceByName } from './migrate-midi-device-by-name'
import { migrateShortcuts } from './migrate-shortcuts'
import { rebuildFtsForSingleCharFix } from './rebuild-fts-single-char-fix'
import { seedSystemRoles } from './seed'
import { seedBibleTranslations } from './seed-bibles'
import { seedSampleMusic } from './seed-music'
import { seedDefaultScreens } from './seed-screens'
import { seedAppSettings } from './seed-settings'
import { seedSongCategories } from './seed-song-categories'
import { seedSongs } from './seed-songs'
import type { Database } from 'bun:sqlite'
import { createFtsTables } from '../fts'

// Resolve migrations folder relative to this file (only used in dev mode)
const _MIGRATIONS_FOLDER = join(import.meta.dir, '../../../drizzle/migrations')

// Check if running in Tauri production mode
const _IS_TAURI_PRODUCTION = process.env.TAURI_MODE === 'true'

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

    try {
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
    } catch (error) {
      log('error', `Failed to apply migration ${migration.tag}: ${error}`)
      throw error
    }
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

  // Always use embedded migrations for consistency between dev and production
  // This ensures the same migration tracking (hash-based) regardless of environment
  let t = performance.now()
  runEmbeddedMigrations(rawDb)
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

  // Add auth columns (is_super_admin, password_hash) and bootstrap the
  // Super Admin owner account. Must run after seedSystemRoles so the admin
  // role exists for the new super admin to inherit its permissions.
  log('info', 'Running user auth fields migration...')
  t = performance.now()
  addUserAuthFields(rawDb)
  logTiming('add_user_auth_fields', t)

  // Backfill the new song_versions.* permissions onto roles + users that
  // already had the matching songs.{create|edit|delete}. Without this,
  // operators who used to be able to link versions would silently lose
  // the affordance when the gate moves to dedicated perms. Must run
  // after seedSystemRoles so the admin role's freshly-seeded ALL_PERMISSIONS
  // already includes the new keys.
  log('info', 'Running add song_versions permissions migration...')
  t = performance.now()
  addSongVersionsPermissions(rawDb)
  logTiming('add_song_versions_permissions', t)

  // Add screen behavior columns BEFORE seeding default screens so the seed can
  // populate them straight from the factory fixture.
  //
  // close_on_escape: replaces the previous keep_visible_on_escape column with
  // inverted semantics; factory screens ship with it OFF (window stays open).
  log('info', 'Running add close_on_escape migration...')
  t = performance.now()
  addCloseOnEscape(rawDb)
  logTiming('add_close_on_escape', t)

  // is_preview_screen: marks the screen mirrored in the in-app control-room
  // preview panel. Defaults the main (first primary) screen on existing DBs.
  log('info', 'Running add is_preview_screen migration...')
  t = performance.now()
  addPreviewScreen(rawDb)
  logTiming('add_preview_screen', t)

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

  // Add last_presented_at column to songs table (must run before seedSongs)
  log('info', 'Running add last_presented_at migration...')
  t = performance.now()
  addLastPresentedAt(rawDb)
  logTiming('add_last_presented_at', t)

  // Add song_groups table + song_group_id column for the Versions feature.
  // Must run before seedSongs so newly seeded songs see the column.
  log('info', 'Running add song_groups migration...')
  t = performance.now()
  addSongGroups(rawDb)
  logTiming('add_song_groups', t)

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

  // Clean up legacy shortcuts (searchSong, searchBible removed from codebase)
  log('info', 'Running shortcuts cleanup migration...')
  t = performance.now()
  migrateShortcuts(rawDb)
  logTiming('migrate_shortcuts', t)

  // Convert legacy MIDI device indices to name-based persistence
  log('info', 'Running MIDI device-by-name migration...')
  t = performance.now()
  migrateMidiDeviceByName(rawDb)
  logTiming('migrate_midi_device_by_name', t)

  // Drop redundant 'key' column from songs table (keyLine is kept)
  log('info', 'Running drop key column migration...')
  t = performance.now()
  dropSongKeyColumn(rawDb)
  logTiming('drop_song_key_column', t)

  // Extract keylines from first slide last paragraphs to keyLine field
  log('info', 'Running extract keylines migration...')
  t = performance.now()
  extractKeylinesFromSlides(rawDb)
  logTiming('extract_keylines_from_slides', t)

  // Seed sample music (only if no music folders exist yet)
  log('info', 'Seeding sample music...')
  t = performance.now()
  seedSampleMusic(rawDb)
  logTiming('seed_sample_music', t)

  // One-shot rebuild of the FTS index after single-char tokens were filtered
  // out of normalizeForIndex (must run AFTER seed-songs so the rebuild has
  // something to index). Skipped on subsequent boots via app_settings flag.
  log('info', 'Running FTS single-char rebuild migration...')
  t = performance.now()
  rebuildFtsForSingleCharFix(rawDb)
  logTiming('rebuild_fts_single_char_fix', t)

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
