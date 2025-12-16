import type { Database } from 'bun:sqlite'
import type { Migration, MigrationResult } from '../engine'

const SCHEMA_SQL = `
-- Application Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key);

-- Cache Metadata Table
CREATE TABLE IF NOT EXISTS cache_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cache_metadata_key ON cache_metadata(key);

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Role Permissions Table
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- Users Table
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

CREATE INDEX IF NOT EXISTS idx_users_token_hash ON users(token_hash);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- User Permissions Table
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- App Sessions Table
CREATE TABLE IF NOT EXISTS app_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL UNIQUE,
  session_token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Local Admin',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_token_hash ON app_sessions(session_token_hash);

-- Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_schedules_title ON schedules(title);

-- Song Categories Table
CREATE TABLE IF NOT EXISTS song_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_song_categories_name ON song_categories(name);

-- Songs Table
CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL COLLATE NOCASE UNIQUE,
  category_id INTEGER,
  source_filename TEXT,
  author TEXT,
  copyright TEXT,
  ccli TEXT,
  key TEXT,
  tempo TEXT,
  time_signature TEXT,
  theme TEXT,
  alt_theme TEXT,
  hymn_number TEXT,
  key_line TEXT,
  presentation_order TEXT,
  presentation_count INTEGER NOT NULL DEFAULT 0,
  last_manual_edit INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (category_id) REFERENCES song_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_category_id ON songs(category_id);

-- Song Slides Table
CREATE TABLE IF NOT EXISTS song_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_song_slides_song_id ON song_slides(song_id);
CREATE INDEX IF NOT EXISTS idx_song_slides_sort_order ON song_slides(sort_order);

-- Schedule Items Table
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

-- Displays Table
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

-- Presentation Queue Table (must be before presentation_state due to FK reference)
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

-- Presentation State Table (singleton)
CREATE TABLE IF NOT EXISTS presentation_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_presenting INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  current_queue_item_id INTEGER REFERENCES presentation_queue(id) ON DELETE SET NULL,
  current_song_slide_id INTEGER REFERENCES song_slides(id) ON DELETE SET NULL,
  last_song_slide_id INTEGER REFERENCES song_slides(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO presentation_state (id, is_presenting) VALUES (1, 0);

-- Bible Translations Table
CREATE TABLE IF NOT EXISTS bible_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  source_filename TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_bible_translations_abbreviation ON bible_translations(abbreviation);

-- Bible Books Table
CREATE TABLE IF NOT EXISTS bible_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id INTEGER NOT NULL,
  book_code TEXT NOT NULL,
  book_name TEXT NOT NULL,
  book_order INTEGER NOT NULL,
  chapter_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (translation_id) REFERENCES bible_translations(id) ON DELETE CASCADE,
  UNIQUE(translation_id, book_code)
);

CREATE INDEX IF NOT EXISTS idx_bible_books_translation_id ON bible_books(translation_id);
CREATE INDEX IF NOT EXISTS idx_bible_books_order ON bible_books(translation_id, book_order);

-- Bible Verses Table
CREATE TABLE IF NOT EXISTS bible_verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (translation_id) REFERENCES bible_translations(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES bible_books(id) ON DELETE CASCADE,
  UNIQUE(translation_id, book_id, chapter, verse)
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_lookup ON bible_verses(book_id, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_bible_verses_translation ON bible_verses(translation_id);

-- Full-Text Search Virtual Tables
-- Uses remove_diacritics=2 for accent-insensitive search (Romanian support)

CREATE VIRTUAL TABLE IF NOT EXISTS schedules_fts USING fts5(
  schedule_id UNINDEXED,
  title,
  description,
  song_titles,
  song_content,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
  song_id UNINDEXED,
  title,
  category_name,
  content,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts_trigram USING fts5(
  song_id UNINDEXED,
  title,
  content,
  tokenize='trigram'
);

CREATE VIRTUAL TABLE IF NOT EXISTS bible_verses_fts USING fts5(
  text,
  content=bible_verses,
  content_rowid=id,
  tokenize='unicode61 remove_diacritics 2'
);
`

const ALL_PERMISSIONS = [
  'songs.view',
  'songs.create',
  'songs.edit',
  'songs.delete',
  'songs.add_to_queue',
  'songs.present_now',
  'bible.view',
  'bible.import',
  'bible.delete',
  'bible.add_to_queue',
  'bible.present_now',
  'control_room.view',
  'control_room.control',
  'programs.view',
  'programs.create',
  'programs.edit',
  'programs.delete',
  'programs.import_to_queue',
  'queue.view',
  'queue.add',
  'queue.remove',
  'queue.reorder',
  'queue.clear',
  'settings.view',
  'settings.edit',
  'displays.view',
  'displays.create',
  'displays.edit',
  'displays.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
]

const ROLE_TEMPLATES: Record<string, string[]> = {
  admin: ALL_PERMISSIONS,
  presenter: [
    'control_room.view',
    'control_room.control',
    'songs.view',
    'songs.add_to_queue',
    'songs.present_now',
    'bible.view',
    'bible.add_to_queue',
    'bible.present_now',
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
    'bible.view',
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
    'bible.view',
    'bible.add_to_queue',
    'programs.view',
    'programs.import_to_queue',
    'control_room.view',
  ],
}

function initializeSystemRoles(db: Database): void {
  for (const [roleName, permissions] of Object.entries(ROLE_TEMPLATES)) {
    db.exec(`
      INSERT OR IGNORE INTO roles (name, is_system)
      VALUES ('${roleName}', 1)
    `)

    const role = db
      .query('SELECT id FROM roles WHERE name = ?')
      .get(roleName) as { id: number } | null

    if (role) {
      for (const permission of permissions) {
        db.run(
          'INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)',
          [role.id, permission],
        )
      }
    }
  }
}

export const migration: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db: Database): MigrationResult => {
    db.exec(SCHEMA_SQL)
    initializeSystemRoles(db)
    return { ftsRecreated: true }
  },
}
