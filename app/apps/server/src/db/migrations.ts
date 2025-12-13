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

-- Roles Table
-- Stores role templates (system and custom roles)
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Role Permissions Table
-- Stores permissions assigned to each role
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- Authorized Users Table
-- Stores user information and their authentication tokens
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_users_token_hash ON users(token_hash);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- User Permissions Table
-- Stores custom permissions per user (extends/overrides role permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, permission)
);

-- Index for permission lookups
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- Schedules Table
-- Stores presentation schedules (collections of songs and slides)
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_schedules_title ON schedules(title);

-- Schedule Items Table
-- Stores items belonging to schedules (same structure as presentation_queue)
CREATE TABLE IF NOT EXISTS schedule_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('song', 'slide')),
  song_id INTEGER,
  slide_type TEXT CHECK (slide_type IN ('announcement', 'versete_tineri')),
  slide_content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule_id ON schedule_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_sort_order ON schedule_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_schedule_items_song_id ON schedule_items(song_id);

-- Full-Text Search Virtual Table for Schedules
-- Enables fast text search across schedule metadata and song content
-- Uses remove_diacritics=2 for accent-insensitive search
CREATE VIRTUAL TABLE IF NOT EXISTS schedules_fts USING fts5(
  schedule_id UNINDEXED,
  title,
  description,
  song_titles,
  song_content,
  tokenize='unicode61 remove_diacritics 2'
);

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

-- Presentation State Table
-- Singleton table storing current presentation state
CREATE TABLE IF NOT EXISTS presentation_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_presenting INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Initialize presentation state with default values
INSERT OR IGNORE INTO presentation_state (id, is_presenting) VALUES (1, 0);

-- Song Categories Table
-- Stores categories for organizing songs
-- Priority: higher value = higher priority in search results
CREATE TABLE IF NOT EXISTS song_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_song_categories_name ON song_categories(name);

-- Songs Table
-- Stores songs with optional category
CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category_id INTEGER,
  source_file_path TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (category_id) REFERENCES song_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_category_id ON songs(category_id);

-- Song Slides Table
-- Stores individual slides belonging to songs
CREATE TABLE IF NOT EXISTS song_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_song_slides_song_id ON song_slides(song_id);
CREATE INDEX IF NOT EXISTS idx_song_slides_sort_order ON song_slides(sort_order);

-- Full-Text Search Virtual Table for Songs
-- Enables fast text search across song titles, categories, and slide content
-- Uses remove_diacritics=2 for accent-insensitive search (e.g., "inger" matches "înger")
-- Column weights for bm25(): title=10, category_name=5, content=1
CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
  song_id UNINDEXED,
  title,
  category_name,
  content,
  tokenize='unicode61 remove_diacritics 2'
);

-- Trigram Full-Text Search Virtual Table for Songs
-- Enables fuzzy/substring matching for similar words (e.g., "Hristos" matches "Cristos")
-- Uses trigram tokenizer which breaks text into 3-character overlapping chunks
-- Note: Requires detail='full' (default) for MATCH queries to work
CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts_trigram USING fts5(
  song_id UNINDEXED,
  title,
  content,
  tokenize='trigram'
);

-- Presentation Queue Table
-- Stores queue items for the control room presentation
-- Supports both songs and standalone slides
CREATE TABLE IF NOT EXISTS presentation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL CHECK (item_type IN ('song', 'slide')),
  song_id INTEGER,
  slide_type TEXT CHECK (slide_type IN ('announcement', 'versete_tineri')),
  slide_content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_expanded INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_presentation_queue_sort_order ON presentation_queue(sort_order);
CREATE INDEX IF NOT EXISTS idx_presentation_queue_song_id ON presentation_queue(song_id);
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
 * All permissions in the system
 */
const ALL_PERMISSIONS = [
  // Songs
  'songs.view',
  'songs.create',
  'songs.edit',
  'songs.delete',
  'songs.add_to_queue',
  'songs.present_now',
  // Control Room
  'control_room.view',
  'control_room.control',
  // Programs
  'programs.view',
  'programs.create',
  'programs.edit',
  'programs.delete',
  'programs.import_to_queue',
  // Queue
  'queue.view',
  'queue.add',
  'queue.remove',
  'queue.reorder',
  'queue.clear',
  // Settings
  'settings.view',
  'settings.edit',
  // Displays
  'displays.view',
  'displays.create',
  'displays.edit',
  'displays.delete',
  // Users
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
]

/**
 * Role templates with their default permissions
 */
const ROLE_TEMPLATES: Record<string, string[]> = {
  admin: ALL_PERMISSIONS,
  presenter: [
    'control_room.view',
    'control_room.control',
    'songs.view',
    'songs.add_to_queue',
    'songs.present_now',
    'queue.view',
    'queue.add',
    'queue.remove',
    'queue.reorder',
    'programs.view',
    'programs.import_to_queue',
    'displays.view',
  ],
  viewer: [
    'control_room.view',
    'songs.view',
    'programs.view',
    'queue.view',
    'displays.view',
  ],
  queue_manager: [
    'queue.view',
    'queue.add',
    'queue.remove',
    'queue.reorder',
    'queue.clear',
    'songs.view',
    'songs.add_to_queue',
    'programs.view',
    'programs.import_to_queue',
    'control_room.view',
  ],
}

/**
 * Initialize system roles with their default permissions
 */
function initializeSystemRoles(db: Database): void {
  log('debug', 'Initializing system roles...')

  for (const [roleName, permissions] of Object.entries(ROLE_TEMPLATES)) {
    // Insert role if not exists
    db.exec(`
      INSERT OR IGNORE INTO roles (name, is_system)
      VALUES ('${roleName}', 1)
    `)

    // Get role id
    const role = db
      .query(`SELECT id FROM roles WHERE name = ?`)
      .get(roleName) as { id: number } | null

    if (role) {
      // Insert permissions for this role
      for (const permission of permissions) {
        db.exec(`
          INSERT OR IGNORE INTO role_permissions (role_id, permission)
          VALUES (${role.id}, '${permission}')
        `)
      }
    }
  }

  log('debug', 'System roles initialized')
}

/**
 * Runs database migrations
 * Executes the embedded schema SQL to create tables and indexes
 */
export function runMigrations(db: Database): void {
  try {
    log('info', 'Running database migrations...')

    // Migration: Drop old programs tables and replace with schedules
    if (tableExists(db, 'programs')) {
      log('info', 'Dropping old programs tables to replace with schedules')
      db.exec(`
        DROP TABLE IF EXISTS display_slide_configs;
        DROP TABLE IF EXISTS slides;
        DROP TABLE IF EXISTS programs;
      `)
      // Reset presentation state program/slide references since programs are removed
      // Only update columns that actually exist
      if (tableExists(db, 'presentation_state')) {
        if (columnExists(db, 'presentation_state', 'program_id')) {
          db.exec(`UPDATE presentation_state SET program_id = NULL`)
        }
        if (columnExists(db, 'presentation_state', 'current_slide_id')) {
          db.exec(`UPDATE presentation_state SET current_slide_id = NULL`)
        }
        if (columnExists(db, 'presentation_state', 'last_slide_id')) {
          db.exec(`UPDATE presentation_state SET last_slide_id = NULL`)
        }
      }
    }

    // Check if we have old songs table without category_id column
    if (tableExists(db, 'songs') && !columnExists(db, 'songs', 'category_id')) {
      log('info', 'Migrating old songs schema - dropping old table...')
      // Drop old songs table (no slides yet in old schema)
      db.exec(`DROP TABLE IF EXISTS songs`)
      log('info', 'Old songs table dropped, will be recreated with new schema')
    }

    // Migration: devices to users - migrate data before dropping
    if (tableExists(db, 'devices')) {
      log('info', 'Migrating devices to users...')

      // First create the new tables if they don't exist
      db.exec(`
        -- Create roles table first
        CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_system INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        -- Create role_permissions table
        CREATE TABLE IF NOT EXISTS role_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role_id INTEGER NOT NULL,
          permission TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
          UNIQUE(role_id, permission)
        );

        -- Create users table
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          token TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          is_active INTEGER NOT NULL DEFAULT 1,
          role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
          last_used_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        -- Create user_permissions table
        CREATE TABLE IF NOT EXISTS user_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          permission TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, permission)
        );
      `)

      // Check if devices has token column (old schema) vs token_hash
      const hasToken = columnExists(db, 'devices', 'token')
      const tokenColumn = hasToken ? 'token' : 'token_hash'

      // Migrate device data to users
      const devices = db
        .query(
          `SELECT id, name, ${tokenColumn} as token_hash, is_active, last_used_at, created_at, updated_at FROM devices`,
        )
        .all() as Array<{
        id: number
        name: string
        token_hash: string
        is_active: number
        last_used_at: number | null
        created_at: number
        updated_at: number
      }>

      for (const device of devices) {
        // Insert user
        db.exec(`
          INSERT OR IGNORE INTO users (name, token_hash, is_active, last_used_at, created_at, updated_at)
          VALUES ('${device.name.replace(/'/g, "''")}', '${device.token_hash}', ${device.is_active}, ${device.last_used_at ?? 'NULL'}, ${device.created_at}, ${device.updated_at})
        `)

        // Get the new user id
        const user = db
          .query(`SELECT id FROM users WHERE token_hash = ?`)
          .get(device.token_hash) as { id: number } | null

        if (user && tableExists(db, 'device_permissions')) {
          // Migrate permissions - convert old feature-based to new action-specific
          const oldPerms = db
            .query(
              `SELECT feature, can_read, can_write, can_delete FROM device_permissions WHERE device_id = ?`,
            )
            .all(device.id) as Array<{
            feature: string
            can_read: number
            can_write: number
            can_delete: number
          }>

          for (const perm of oldPerms) {
            // Map old feature+action to new permission strings
            const permMappings: Array<{
              old: { feature: string; action: string }
              new: string
            }> = [
              // Songs
              {
                old: { feature: 'songs', action: 'read' },
                new: 'songs.view',
              },
              {
                old: { feature: 'songs', action: 'write' },
                new: 'songs.create',
              },
              {
                old: { feature: 'songs', action: 'write' },
                new: 'songs.edit',
              },
              {
                old: { feature: 'songs', action: 'write' },
                new: 'songs.add_to_queue',
              },
              {
                old: { feature: 'songs', action: 'write' },
                new: 'songs.present_now',
              },
              {
                old: { feature: 'songs', action: 'delete' },
                new: 'songs.delete',
              },
              // Schedules -> programs
              {
                old: { feature: 'schedules', action: 'read' },
                new: 'programs.view',
              },
              {
                old: { feature: 'schedules', action: 'write' },
                new: 'programs.create',
              },
              {
                old: { feature: 'schedules', action: 'write' },
                new: 'programs.edit',
              },
              {
                old: { feature: 'schedules', action: 'write' },
                new: 'programs.import_to_queue',
              },
              {
                old: { feature: 'schedules', action: 'delete' },
                new: 'programs.delete',
              },
              // Presentation -> control_room + queue
              {
                old: { feature: 'presentation', action: 'read' },
                new: 'control_room.view',
              },
              {
                old: { feature: 'presentation', action: 'read' },
                new: 'queue.view',
              },
              {
                old: { feature: 'presentation', action: 'write' },
                new: 'control_room.control',
              },
              {
                old: { feature: 'presentation', action: 'write' },
                new: 'queue.add',
              },
              {
                old: { feature: 'presentation', action: 'write' },
                new: 'queue.remove',
              },
              {
                old: { feature: 'presentation', action: 'write' },
                new: 'queue.reorder',
              },
              {
                old: { feature: 'presentation', action: 'delete' },
                new: 'queue.clear',
              },
              // Settings
              {
                old: { feature: 'settings', action: 'read' },
                new: 'settings.view',
              },
              {
                old: { feature: 'settings', action: 'write' },
                new: 'settings.edit',
              },
              {
                old: { feature: 'settings', action: 'read' },
                new: 'displays.view',
              },
              {
                old: { feature: 'settings', action: 'write' },
                new: 'displays.create',
              },
              {
                old: { feature: 'settings', action: 'write' },
                new: 'displays.edit',
              },
              {
                old: { feature: 'settings', action: 'delete' },
                new: 'displays.delete',
              },
              {
                old: { feature: 'settings', action: 'read' },
                new: 'users.view',
              },
              {
                old: { feature: 'settings', action: 'write' },
                new: 'users.create',
              },
              {
                old: { feature: 'settings', action: 'write' },
                new: 'users.edit',
              },
              {
                old: { feature: 'settings', action: 'delete' },
                new: 'users.delete',
              },
            ]

            for (const mapping of permMappings) {
              if (mapping.old.feature === perm.feature) {
                const hasAction =
                  (mapping.old.action === 'read' && perm.can_read) ||
                  (mapping.old.action === 'write' && perm.can_write) ||
                  (mapping.old.action === 'delete' && perm.can_delete)

                if (hasAction) {
                  db.exec(`
                    INSERT OR IGNORE INTO user_permissions (user_id, permission)
                    VALUES (${user.id}, '${mapping.new}')
                  `)
                }
              }
            }
          }
        }
      }

      // Drop old tables
      db.exec(`
        DROP TABLE IF EXISTS device_permissions;
        DROP TABLE IF EXISTS devices;
        DROP INDEX IF EXISTS idx_devices_token_hash;
        DROP INDEX IF EXISTS idx_devices_is_active;
        DROP INDEX IF EXISTS idx_device_permissions_device_id;
      `)

      log('info', 'Devices migrated to users successfully')
    }

    // Migration: Drop and recreate presentation_queue if it has incomplete schema
    // This is a new feature so no data loss concerns
    if (
      tableExists(db, 'presentation_queue') &&
      (!columnExists(db, 'presentation_queue', 'song_id') ||
        !columnExists(db, 'presentation_queue', 'sort_order') ||
        !columnExists(db, 'presentation_queue', 'is_expanded'))
    ) {
      log(
        'info',
        'Dropping incomplete presentation_queue table to recreate with correct schema',
      )
      db.exec(`
        DROP INDEX IF EXISTS idx_presentation_queue_sort_order;
        DROP INDEX IF EXISTS idx_presentation_queue_song_id;
        DROP TABLE IF EXISTS presentation_queue;
      `)
    }

    // Migration: Drop and recreate presentation_queue if it doesn't support standalone slides
    // This adds slide_type and slide_content columns for standalone slide items
    if (
      tableExists(db, 'presentation_queue') &&
      !columnExists(db, 'presentation_queue', 'slide_type')
    ) {
      log(
        'info',
        'Dropping presentation_queue table to add standalone slide support',
      )
      // First remove FK column from presentation_state if it exists
      if (
        tableExists(db, 'presentation_state') &&
        columnExists(db, 'presentation_state', 'current_queue_item_id')
      ) {
        db.exec(
          `ALTER TABLE presentation_state DROP COLUMN current_queue_item_id`,
        )
      }
      db.exec(`
        DROP INDEX IF EXISTS idx_presentation_queue_sort_order;
        DROP INDEX IF EXISTS idx_presentation_queue_song_id;
        DROP TABLE IF EXISTS presentation_queue;
      `)
    }

    // Migration: Handle orphaned FK column if presentation_queue doesn't exist
    // but presentation_state has the FK column
    if (
      !tableExists(db, 'presentation_queue') &&
      tableExists(db, 'presentation_state') &&
      columnExists(db, 'presentation_state', 'current_queue_item_id')
    ) {
      log(
        'info',
        'Removing orphaned current_queue_item_id column from presentation_state',
      )
      db.exec(
        `ALTER TABLE presentation_state DROP COLUMN current_queue_item_id`,
      )
    }

    // Migration: Recreate songs_fts table with updated tokenizer for diacritic support
    // Drop the old FTS table so it gets recreated with remove_diacritics=2
    if (tableExists(db, 'songs_fts')) {
      log('info', 'Dropping songs_fts table to recreate with diacritic support')
      db.exec('DROP TABLE IF EXISTS songs_fts')
    }

    // Migration: Recreate schedules_fts table with correct schema
    // Drop and recreate to ensure column structure matches expected schema
    if (tableExists(db, 'schedules_fts')) {
      log(
        'info',
        'Dropping schedules_fts table to recreate with correct schema',
      )
      db.exec('DROP TABLE IF EXISTS schedules_fts')
    }

    // Migration: Recreate songs_fts_trigram table to support MATCH queries
    // The previous version had detail='none' which doesn't support MATCH
    if (tableExists(db, 'songs_fts_trigram')) {
      log('info', 'Dropping songs_fts_trigram to recreate with full detail')
      db.exec('DROP TABLE IF EXISTS songs_fts_trigram')
    }

    log('debug', 'Loading embedded schema')

    // Execute embedded schema (exec for multiple statements)
    db.exec(SCHEMA_SQL)

    // Initialize system roles with default permissions
    initializeSystemRoles(db)

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

    // Migration: Add current_queue_item_id column to presentation_state table if it doesn't exist
    if (
      tableExists(db, 'presentation_state') &&
      !columnExists(db, 'presentation_state', 'current_queue_item_id')
    ) {
      log(
        'info',
        'Adding current_queue_item_id column to presentation_state table',
      )
      db.exec(
        `ALTER TABLE presentation_state ADD COLUMN current_queue_item_id INTEGER REFERENCES presentation_queue(id) ON DELETE SET NULL`,
      )
    }

    // Migration: Add current_song_slide_id column to presentation_state table if it doesn't exist
    if (
      tableExists(db, 'presentation_state') &&
      !columnExists(db, 'presentation_state', 'current_song_slide_id')
    ) {
      log(
        'info',
        'Adding current_song_slide_id column to presentation_state table',
      )
      db.exec(
        `ALTER TABLE presentation_state ADD COLUMN current_song_slide_id INTEGER REFERENCES song_slides(id) ON DELETE SET NULL`,
      )
    }

    // Migration: Add last_song_slide_id column to presentation_state table if it doesn't exist
    if (
      tableExists(db, 'presentation_state') &&
      !columnExists(db, 'presentation_state', 'last_song_slide_id')
    ) {
      log(
        'info',
        'Adding last_song_slide_id column to presentation_state table',
      )
      db.exec(
        `ALTER TABLE presentation_state ADD COLUMN last_song_slide_id INTEGER REFERENCES song_slides(id) ON DELETE SET NULL`,
      )
    }

    // Migration: Add is_hidden column to presentation_state table if it doesn't exist
    if (
      tableExists(db, 'presentation_state') &&
      !columnExists(db, 'presentation_state', 'is_hidden')
    ) {
      log('info', 'Adding is_hidden column to presentation_state table')
      db.exec(
        `ALTER TABLE presentation_state ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0`,
      )
    }

    // Migration: Add source_file_path column to songs table if it doesn't exist
    if (
      tableExists(db, 'songs') &&
      !columnExists(db, 'songs', 'source_file_path')
    ) {
      log('info', 'Adding source_file_path column to songs table')
      db.exec(`ALTER TABLE songs ADD COLUMN source_file_path TEXT`)
    }

    // Migration: Add OpenSong metadata columns to songs table
    if (tableExists(db, 'songs') && !columnExists(db, 'songs', 'author')) {
      log('info', 'Adding OpenSong metadata columns to songs table')
      db.exec(`ALTER TABLE songs ADD COLUMN author TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN copyright TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN ccli TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN key TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN tempo TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN time_signature TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN theme TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN alt_theme TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN hymn_number TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN key_line TEXT`)
      db.exec(`ALTER TABLE songs ADD COLUMN presentation_order TEXT`)
    }

    // Migration: Add label column to song_slides table for verse labels (V1, C, etc.)
    if (
      tableExists(db, 'song_slides') &&
      !columnExists(db, 'song_slides', 'label')
    ) {
      log('info', 'Adding label column to song_slides table')
      db.exec(`ALTER TABLE song_slides ADD COLUMN label TEXT`)
    }

    // Migration: Add priority column to song_categories table for search ranking
    if (
      tableExists(db, 'song_categories') &&
      !columnExists(db, 'song_categories', 'priority')
    ) {
      log('info', 'Adding priority column to song_categories table')
      db.exec(
        `ALTER TABLE song_categories ADD COLUMN priority INTEGER NOT NULL DEFAULT 1`,
      )
    }

    // Migration: Add token column to users table to store plaintext token for QR code display
    if (tableExists(db, 'users') && !columnExists(db, 'users', 'token')) {
      log('info', 'Adding token column to users table')
      // For existing users without a token, we need to regenerate tokens
      // This is a breaking change - existing tokens will need to be regenerated
      db.exec(`ALTER TABLE users ADD COLUMN token TEXT DEFAULT ''`)
    }

    log('info', 'Migrations completed successfully')
  } catch (error) {
    log('error', `Migration failed: ${error}`)
    throw error
  }
}
