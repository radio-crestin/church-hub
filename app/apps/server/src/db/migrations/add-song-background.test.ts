import { addSongBackground } from './add-song-background'
import Database from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'

function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run(`
    CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL
    )
  `)
  db.run("INSERT INTO songs (title) VALUES ('Existing song')")
  return db
}

function songColumns(db: Database): string[] {
  return db
    .query<{ name: string }, []>('PRAGMA table_info(songs)')
    .all()
    .map((col) => col.name)
}

describe('addSongBackground', () => {
  test('adds a nullable background column, leaving existing songs on NULL', () => {
    const db = createTestDb()
    addSongBackground(db)

    expect(songColumns(db)).toContain('background')
    const row = db
      .query<{ background: string | null }, []>('SELECT background FROM songs')
      .get()
    expect(row?.background).toBeNull()
  })

  test('is idempotent, with or without the applied marker', () => {
    const db = createTestDb()
    addSongBackground(db)
    addSongBackground(db)

    // Without the marker row the column check alone must prevent a second
    // ALTER TABLE (which SQLite would reject as a duplicate column).
    db.run("DELETE FROM app_settings WHERE key = 'add_song_background_v1'")
    expect(() => addSongBackground(db)).not.toThrow()
    expect(songColumns(db).filter((c) => c === 'background')).toHaveLength(1)
  })
})
