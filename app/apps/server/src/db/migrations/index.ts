import { join } from 'node:path'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'

import { addBackupConfig } from './add-backup-config'
import { addCategoryHiddenFlag } from './add-category-hidden-flag'
import { addCloseOnEscape } from './add-close-on-escape'
import { addLastPresentedAt } from './add-last-presented-at'
import { addLogsPermissions } from './add-logs-permissions'
import { addPreviewScreen } from './add-preview-screen'
import { addScheduleItemSung } from './add-schedule-item-sung'
import { addScreenOpenOnStartup } from './add-screen-open-on-startup'
import { addSongBookmarkSung } from './add-song-bookmark-sung'
import { addSongGroups } from './add-song-groups'
import { addSongSlideNotes } from './add-song-slide-notes'
import { addSync } from './add-sync'
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
import { reportError } from '../../utils/reportError'
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
/**
 * Runs one migration/seed step with timing AND error attribution. On failure
 * the step name is reported to BOTH the on-disk log and PostHog (so a field
 * failure tells us exactly which migration broke), then rethrown so the boot
 * sequence still fails loudly — bootState reports the overall boot failure.
 */
function runStep(key: string, label: string, fn: () => void): void {
  log('info', `${label}...`)
  const start = performance.now()
  try {
    fn()
  } catch (error) {
    reportError(error, 'migration', { migration: key })
    throw error
  }
  // biome-ignore lint/suspicious/noConsole: Startup timing logs
  console.log(`[startup] ${key}: ${(performance.now() - start).toFixed(1)}ms`)
}

export function runMigrations(
  _drizzleDb: BunSQLiteDatabase,
  rawDb: Database,
): MigrationResult {
  // Always use embedded migrations for consistency between dev and production
  // (same hash-based tracking regardless of environment).
  runStep('drizzle_migrations', 'Running Drizzle migrations', () =>
    runEmbeddedMigrations(rawDb),
  )
  log('info', 'Drizzle migrations complete')

  // Create FTS virtual tables (Drizzle cannot manage these)
  let ftsCreated = false
  runStep('fts_tables', 'Creating FTS tables', () => {
    ftsCreated = createFtsTables()
  })

  // Initialize presentation_state singleton row
  runStep('init_presentation_state', 'Initializing presentation state', () =>
    initializePresentationState(rawDb),
  )

  // Seed system roles and permissions
  runStep('seed_roles', 'Seeding system roles', () => seedSystemRoles(rawDb))

  // Add auth columns (is_super_admin, password_hash) and bootstrap the
  // Super Admin owner account. Must run after seedSystemRoles so the admin
  // role exists for the new super admin to inherit its permissions.
  runStep('add_user_auth_fields', 'Running user auth fields migration', () =>
    addUserAuthFields(rawDb),
  )

  // Backfill the new song_versions.* permissions onto roles + users that
  // already had the matching songs.{create|edit|delete}. Without this,
  // operators who used to be able to link versions would silently lose
  // the affordance when the gate moves to dedicated perms. Must run
  // after seedSystemRoles so the admin role's freshly-seeded ALL_PERMISSIONS
  // already includes the new keys.
  runStep(
    'add_song_versions_permissions',
    'Running add song_versions permissions migration',
    () => addSongVersionsPermissions(rawDb),
  )

  // Backfill the new logs.view permission onto roles + users that already had
  // settings.edit, so settings editors keep the log access they had via the
  // Developer settings before the dedicated Logs section existed. Must run
  // after seedSystemRoles so the admin role already has logs.* from the seed.
  runStep(
    'add_logs_permissions',
    'Running add logs permissions migration',
    () => addLogsPermissions(rawDb),
  )

  // Add screen behavior columns BEFORE seeding default screens so the seed can
  // populate them straight from the factory fixture. close_on_escape replaces
  // the previous keep_visible_on_escape column with inverted semantics.
  runStep('add_close_on_escape', 'Running add close_on_escape migration', () =>
    addCloseOnEscape(rawDb),
  )

  // is_preview_screen: marks the screen mirrored in the in-app control-room
  // preview panel. Defaults the main (first primary) screen on existing DBs.
  runStep('add_preview_screen', 'Running add is_preview_screen migration', () =>
    addPreviewScreen(rawDb),
  )

  // is_hidden on song_categories: lets an admin hide a category (and its songs)
  // from the song browser without deleting anything.
  runStep(
    'add_category_hidden_flag',
    'Running add category is_hidden migration',
    () => addCategoryHiddenFlag(rawDb),
  )

  // open_on_startup on screens: whether the window opens automatically at
  // launch, split out of is_active. Before seed_screens so the seed can set it.
  runStep(
    'add_screen_open_on_startup',
    'Running add screen open_on_startup migration',
    () => addScreenOpenOnStartup(rawDb),
  )

  // Seed default screens
  runStep('seed_screens', 'Seeding default screens', () =>
    seedDefaultScreens(rawDb),
  )

  // Seed song categories (before songs, as songs reference categories)
  runStep('seed_song_categories', 'Seeding song categories', () =>
    seedSongCategories(rawDb),
  )

  // Add last_presented_at column to songs table (must run before seedSongs)
  runStep(
    'add_last_presented_at',
    'Running add last_presented_at migration',
    () => addLastPresentedAt(rawDb),
  )

  // Add song_groups table + song_group_id column for the Versions feature.
  // Must run before seedSongs so newly seeded songs see the column.
  runStep('add_song_groups', 'Running add song_groups migration', () =>
    addSongGroups(rawDb),
  )

  // Seed songs
  runStep('seed_songs', 'Seeding songs', () => seedSongs(rawDb))

  // Seed bible translations metadata
  runStep('seed_bible_translations', 'Seeding bible translations', () =>
    seedBibleTranslations(rawDb),
  )

  // Seed app settings (sidebar config, search synonyms, appearance, etc.)
  runStep('seed_app_settings', 'Seeding app settings', () =>
    seedAppSettings(rawDb),
  )

  // Clean up legacy shortcuts (searchSong, searchBible removed from codebase)
  runStep('migrate_shortcuts', 'Running shortcuts cleanup migration', () =>
    migrateShortcuts(rawDb),
  )

  // Convert legacy MIDI device indices to name-based persistence
  runStep(
    'migrate_midi_device_by_name',
    'Running MIDI device-by-name migration',
    () => migrateMidiDeviceByName(rawDb),
  )

  // Drop redundant 'key' column from songs table (keyLine is kept)
  runStep('drop_song_key_column', 'Running drop key column migration', () =>
    dropSongKeyColumn(rawDb),
  )

  // Extract keylines from first slide last paragraphs to keyLine field
  runStep(
    'extract_keylines_from_slides',
    'Running extract keylines migration',
    () => extractKeylinesFromSlides(rawDb),
  )

  // Seed sample music (only if no music folders exist yet)
  runStep('seed_sample_music', 'Seeding sample music', () =>
    seedSampleMusic(rawDb),
  )

  // One-shot rebuild of the FTS index after single-char tokens were filtered
  // out of normalizeForIndex (must run AFTER seed-songs so the rebuild has
  // something to index). Skipped on subsequent boots via app_settings flag.
  runStep(
    'rebuild_fts_single_char_fix',
    'Running FTS single-char rebuild migration',
    () => rebuildFtsForSingleCharFix(rawDb),
  )

  // Add backup_config table for the Google Drive backup feature
  runStep('add_backup_config', 'Running add backup_config migration', () =>
    addBackupConfig(rawDb),
  )

  // Add notes column to song_slides (per-slide speaker notes).
  runStep(
    'add_song_slide_notes',
    'Running add song_slide notes migration',
    () => addSongSlideNotes(rawDb),
  )

  // Add is_sung/sung_at to song_bookmarks (manual "already sung" marker).
  runStep(
    'add_song_bookmark_sung',
    'Running add song_bookmark sung migration',
    () => addSongBookmarkSung(rawDb),
  )

  // Add is_sung/sung_at to schedule_items so a schedule tracks which of its
  // songs were already sung, independently of the global bookmarks list.
  runStep(
    'add_schedule_item_sung',
    'Running add schedule_item sung migration',
    () => addScheduleItemSung(rawDb),
  )

  // Google Drive library sync: uuid identity columns, sync engine tables and
  // change-tracking triggers. Must run LAST so seeded rows get their uuid
  // backfilled without being marked as dirty local edits.
  runStep('add_sync', 'Running add sync migration', () => addSync(rawDb))

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
