import type { Database } from 'bun:sqlite'

/**
 * Tables for the user's own song sources. Idempotent.
 * - song_source_storage: the one S3 bucket the user publishes to. Its own
 *   table, never app_settings, so no settings endpoint or fixture dump can
 *   ever return the secret key.
 * - song_source_publications: categories published to that bucket, with the
 *   manifest as last uploaded (its song hashes let a sync upload only
 *   what changed).
 * - song_source_subscriptions: sources added from someone's shared link.
 * - song_source_song_cache: songs already downloaded from a shared folder,
 *   by hash, so a refresh downloads only the songs that changed.
 */
export function addSongSources(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS song_source_storage (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      endpoint TEXT NOT NULL,
      region TEXT,
      bucket TEXT NOT NULL,
      path_prefix TEXT NOT NULL DEFAULT '',
      access_key_id TEXT NOT NULL,
      secret_access_key TEXT NOT NULL,
      public_base_url TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS song_source_publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL UNIQUE
        REFERENCES song_categories(id) ON DELETE CASCADE,
      folder TEXT NOT NULL UNIQUE,
      published_manifest TEXT,
      last_synced_at INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS song_source_subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_name TEXT NOT NULL,
      format TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS song_source_song_cache (
      manifest_url TEXT NOT NULL,
      song_id TEXT NOT NULL,
      hash TEXT NOT NULL,
      contents TEXT NOT NULL,
      PRIMARY KEY (manifest_url, song_id)
    )
  `)
}
