import type { Database } from "bun:sqlite";

const DEBUG = process.env.DEBUG === "true";

/**
 * Logs debug messages if DEBUG env variable is enabled
 */
function log(level: "debug" | "info" | "warning" | "error", message: string) {
  if (level === "debug" && !DEBUG) return;
  console.log(`[${level.toUpperCase()}] [MIGRATIONS] ${message}`);
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
`;

/**
 * Runs database migrations
 * Executes the embedded schema SQL to create tables and indexes
 */
export function runMigrations(db: Database): void {
  try {
    log("info", "Running database migrations...");
    log("debug", "Loading embedded schema");

    // Execute embedded schema
    db.run(SCHEMA_SQL);

    log("info", "Migrations completed successfully");
  } catch (error) {
    log("error", `Migration failed: ${error}`);
    throw error;
  }
}
