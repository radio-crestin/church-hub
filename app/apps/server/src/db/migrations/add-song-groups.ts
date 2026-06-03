import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-song-groups:${level}] ${message}`)
}

/**
 * Adds the `song_groups` table and the `song_group_id` column on `songs`
 * used by the Song Versions feature. Versions of the same underlying song
 * (translations, lyric edits, denominational variants) are linked via a
 * shared `song_group_id`; one member is marked canonical via the group's
 * `primary_song_id`. Membership is non-destructive: members keep their
 * own rows in `songs`.
 *
 * Idempotent — safe to run on every boot.
 */
export function addSongGroups(db: Database): void {
  const tableExists = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'song_groups'",
    )
    .get()

  if (!tableExists) {
    log('info', 'Creating "song_groups" table...')
    db.run(`
      CREATE TABLE song_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        canonical_title TEXT NOT NULL,
        primary_song_id INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
    db.run(
      'CREATE INDEX idx_song_groups_primary ON song_groups (primary_song_id)',
    )
  }

  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(songs)')
    .all()

  if (!columns.some((col) => col.name === 'song_group_id')) {
    log('info', 'Adding "song_group_id" column to songs...')
    db.run(
      'ALTER TABLE songs ADD COLUMN song_group_id INTEGER REFERENCES song_groups(id) ON DELETE SET NULL',
    )
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_songs_song_group_id ON songs (song_group_id)',
    )
  }
}
