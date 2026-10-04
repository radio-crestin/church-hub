import type { Database } from 'bun:sqlite'

/**
 * Adds the `song_edit_history` table: one row per saved change to a song (who,
 * when, and the title + slides before and after). Idempotent.
 */
export function addSongEditHistory(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS song_edit_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      edited_by_user_id INTEGER,
      edited_by_name TEXT NOT NULL,
      before_snapshot TEXT,
      after_snapshot TEXT NOT NULL,
      restored_from_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_song_edit_history_song_created ON song_edit_history (song_id, created_at)',
  )
}
