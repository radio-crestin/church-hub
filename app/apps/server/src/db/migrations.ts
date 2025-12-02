import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

/**
 * Logs debug messages if DEBUG env variable is enabled
 */
function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
}

// Embedded schema SQL for compiled binary compatibility
const SCHEMA_SQL = `
-- Application Settings Table
-- Stores application-level configuration (theme, language, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for faster lookups by key
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- User Preferences Table
-- Stores user-specific configurations and preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for faster lookups by key
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key);

-- Cache Metadata Table
-- Stores cache and synchronization metadata
CREATE TABLE IF NOT EXISTS cache_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for faster lookups by key
CREATE INDEX IF NOT EXISTS idx_cache_metadata_key ON cache_metadata(key);

-- Authorized Devices Table
-- Stores device information and their authentication tokens
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for device lookups
CREATE INDEX IF NOT EXISTS idx_devices_token_hash ON devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_devices_is_active ON devices(is_active);

-- Device Permissions Table
-- Stores granular permissions per device per feature
CREATE TABLE IF NOT EXISTS device_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  feature TEXT NOT NULL,
  can_read INTEGER NOT NULL DEFAULT 0,
  can_write INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE(device_id, feature)
);

-- Index for permission lookups
CREATE INDEX IF NOT EXISTS idx_device_permissions_device_id ON device_permissions(device_id);

-- Programs Table
-- Stores presentation programs (collections of slides)
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_programs_name ON programs(name);

-- Slides Table
-- Stores individual slides belonging to programs
CREATE TABLE IF NOT EXISTS slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slides_program_id ON slides(program_id);
CREATE INDEX IF NOT EXISTS idx_slides_sort_order ON slides(sort_order);

-- Displays Table
-- Stores display configurations for presentation outputs
CREATE TABLE IF NOT EXISTS displays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  open_mode TEXT NOT NULL DEFAULT 'browser',
  is_fullscreen INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_displays_is_active ON displays(is_active);

-- Display Slide Configurations Table
-- Stores per-slide per-display configuration overrides
CREATE TABLE IF NOT EXISTS display_slide_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id INTEGER NOT NULL,
  slide_id INTEGER NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE,
  FOREIGN KEY (slide_id) REFERENCES slides(id) ON DELETE CASCADE,
  UNIQUE(display_id, slide_id)
);

CREATE INDEX IF NOT EXISTS idx_display_slide_configs_display_id ON display_slide_configs(display_id);
CREATE INDEX IF NOT EXISTS idx_display_slide_configs_slide_id ON display_slide_configs(slide_id);

-- Presentation State Table
-- Singleton table storing current presentation state
CREATE TABLE IF NOT EXISTS presentation_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  program_id INTEGER,
  current_slide_id INTEGER,
  last_slide_id INTEGER,
  is_presenting INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
  FOREIGN KEY (current_slide_id) REFERENCES slides(id) ON DELETE SET NULL,
  FOREIGN KEY (last_slide_id) REFERENCES slides(id) ON DELETE SET NULL
);

-- Initialize presentation state with default values
INSERT OR IGNORE INTO presentation_state (id, is_presenting) VALUES (1, 0);
`

/**
 * Checks if a column exists in a table
 */
function columnExists(
  db: Database,
  tableName: string,
  columnName: string,
): boolean {
  const result = db.query(`PRAGMA table_info(${tableName})`).all() as {
    name: string
  }[]
  return result.some((col) => col.name === columnName)
}

/**
 * Checks if a table exists
 */
function tableExists(db: Database, tableName: string): boolean {
  const result = db
    .query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
    )
    .get()
  return !!result
}

/**
 * Runs database migrations
 * Executes the embedded schema SQL to create tables and indexes
 */
export function runMigrations(db: Database): void {
  try {
    log('info', 'Running database migrations...')

    // Check if we have old devices schema that needs migration
    if (
      tableExists(db, 'devices') &&
      columnExists(db, 'devices', 'device_type')
    ) {
      log('info', 'Migrating old devices schema - dropping old tables...')

      // Drop old tables completely and recreate with new schema
      db.exec(`
        DROP TABLE IF EXISTS device_permissions;
        DROP TABLE IF EXISTS devices;
      `)

      log(
        'info',
        'Old devices tables dropped, will be recreated with new schema',
      )
    } else if (
      tableExists(db, 'devices') &&
      columnExists(db, 'devices', 'token')
    ) {
      log('info', 'Migrating old devices schema...')

      // Drop old indexes
      db.exec(`
        DROP INDEX IF EXISTS idx_devices_token;
        DROP INDEX IF EXISTS idx_devices_active;
      `)

      // Rename token to token_hash
      db.exec(`ALTER TABLE devices RENAME COLUMN token TO token_hash`)

      // Rename last_seen to last_used_at if it exists
      if (columnExists(db, 'devices', 'last_seen')) {
        db.exec(`ALTER TABLE devices RENAME COLUMN last_seen TO last_used_at`)
      }

      log('info', 'Old devices schema migrated successfully')
    }

    log('debug', 'Loading embedded schema')

    // Execute embedded schema (exec for multiple statements)
    db.exec(SCHEMA_SQL)

    // Migration: Add open_mode column to displays table if it doesn't exist
    if (
      tableExists(db, 'displays') &&
      !columnExists(db, 'displays', 'open_mode')
    ) {
      log('info', 'Adding open_mode column to displays table')
      db.exec(
        `ALTER TABLE displays ADD COLUMN open_mode TEXT NOT NULL DEFAULT 'browser'`,
      )
    }

    // Migration: Add is_fullscreen column to displays table if it doesn't exist
    if (
      tableExists(db, 'displays') &&
      !columnExists(db, 'displays', 'is_fullscreen')
    ) {
      log('info', 'Adding is_fullscreen column to displays table')
      db.exec(
        `ALTER TABLE displays ADD COLUMN is_fullscreen INTEGER NOT NULL DEFAULT 0`,
      )
    }

    // Migration: Add last_slide_id column to presentation_state table if it doesn't exist
    if (
      tableExists(db, 'presentation_state') &&
      !columnExists(db, 'presentation_state', 'last_slide_id')
    ) {
      log('info', 'Adding last_slide_id column to presentation_state table')
      db.exec(
        `ALTER TABLE presentation_state ADD COLUMN last_slide_id INTEGER REFERENCES slides(id) ON DELETE SET NULL`,
      )
    }

    log('info', 'Migrations completed successfully')
  } catch (error) {
    log('error', `Migration failed: ${error}`)
    throw error
  }
}
