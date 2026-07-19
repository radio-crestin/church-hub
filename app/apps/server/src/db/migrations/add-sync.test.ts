import { addSync } from './add-sync'
import Database from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'

/**
 * Minimal replica of the synced tables — only the columns the add-sync
 * migration and its triggers touch. The real schema is a superset.
 */
function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run('PRAGMA foreign_keys = ON')
  db.run(`
    CREATE TABLE song_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE song_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_title TEXT NOT NULL,
      primary_song_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category_id INTEGER REFERENCES song_categories(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE song_slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE schedule_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE schedule_bible_passage_verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
      reference TEXT NOT NULL DEFAULT ''
    )
  `)
  db.run(`
    CREATE TABLE schedule_versete_tineri_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
      person_name TEXT NOT NULL DEFAULT ''
    )
  `)
  return db
}

function pendingRows(db: Database) {
  return db
    .query<{ entity_type: string; entity_uuid: string }, []>(
      'SELECT entity_type, entity_uuid FROM sync_pending ORDER BY entity_type',
    )
    .all()
}

function tombstoneRows(db: Database) {
  return db
    .query<{ entity_type: string; entity_uuid: string }, []>(
      'SELECT entity_type, entity_uuid FROM sync_tombstones',
    )
    .all()
}

describe('addSync migration', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
    addSync(db)
  })

  test('is idempotent (safe to run on every boot)', () => {
    expect(() => addSync(db)).not.toThrow()
  })

  test('backfills uuids on existing rows without marking them dirty', () => {
    const fresh = createTestDb()
    fresh.run("INSERT INTO songs (title, updated_at) VALUES ('Existing', 100)")
    addSync(fresh)

    const row = fresh
      .query<{ uuid: string; updated_at: number }, []>(
        'SELECT uuid, updated_at FROM songs',
      )
      .get()
    expect(row?.uuid).toMatch(/^[0-9a-f]{32}$/)
    // Backfill must not bump updated_at or queue a fake local edit.
    expect(row?.updated_at).toBe(100)
    expect(pendingRows(fresh)).toHaveLength(0)
  })

  test('assigns a uuid to newly inserted rows and queues them as pending', () => {
    db.run("INSERT INTO songs (title) VALUES ('New Song')")

    const row = db.query<{ uuid: string }, []>('SELECT uuid FROM songs').get()
    expect(row?.uuid).toMatch(/^[0-9a-f]{32}$/)
    expect(pendingRows(db)).toEqual([
      { entity_type: 'song', entity_uuid: row?.uuid ?? '' },
    ])
  })

  test('updates queue the row and repair a missing updated_at bump', () => {
    db.run("INSERT INTO songs (title) VALUES ('Song')")
    db.run('DELETE FROM sync_pending')
    db.run('UPDATE songs SET updated_at = 100')
    db.run('DELETE FROM sync_pending')

    // A write path that "forgets" to set updated_at still gets a fresh stamp.
    db.run("UPDATE songs SET title = 'Renamed'")

    const row = db
      .query<{ updated_at: number }, []>('SELECT updated_at FROM songs')
      .get()
    expect(row?.updated_at).toBeGreaterThan(100)
    expect(pendingRows(db)).toHaveLength(1)
  })

  test('deletes leave a tombstone and clear the pending entry', () => {
    db.run("INSERT INTO songs (title) VALUES ('Doomed')")
    const uuid = db.query<{ uuid: string }, []>('SELECT uuid FROM songs').get()
      ?.uuid as string

    db.run('DELETE FROM songs')

    expect(tombstoneRows(db)).toEqual([
      { entity_type: 'song', entity_uuid: uuid },
    ])
    expect(pendingRows(db)).toHaveLength(0)
  })

  test('child edits (slides) mark the parent song as pending', () => {
    db.run("INSERT INTO songs (title) VALUES ('Parent')")
    const uuid = db.query<{ uuid: string }, []>('SELECT uuid FROM songs').get()
      ?.uuid as string
    db.run('UPDATE songs SET updated_at = 100 WHERE id = 1')
    db.run('DELETE FROM sync_pending')

    db.run("INSERT INTO song_slides (song_id, content) VALUES (1, 'Verse 1')")

    expect(pendingRows(db)).toEqual([
      { entity_type: 'song', entity_uuid: uuid },
    ])
    const parent = db
      .query<{ updated_at: number }, []>('SELECT updated_at FROM songs')
      .get()
    expect(parent?.updated_at).toBeGreaterThan(100)
  })

  test('nested schedule verse edits mark the schedule as pending', () => {
    db.run("INSERT INTO schedules (title) VALUES ('Sunday')")
    db.run('INSERT INTO schedule_items (schedule_id) VALUES (1)')
    const uuid = db
      .query<{ uuid: string }, []>('SELECT uuid FROM schedules')
      .get()?.uuid as string
    db.run('DELETE FROM sync_pending')

    db.run(
      "INSERT INTO schedule_bible_passage_verses (schedule_item_id, reference) VALUES (1, 'John 3:16')",
    )

    expect(pendingRows(db)).toEqual([
      { entity_type: 'schedule', entity_uuid: uuid },
    ])
  })

  test('deleting a schedule cascades without stray pending entries', () => {
    db.run("INSERT INTO schedules (title) VALUES ('Sunday')")
    db.run('INSERT INTO schedule_items (schedule_id) VALUES (1)')
    db.run('DELETE FROM sync_pending')

    db.run('DELETE FROM schedules')

    expect(pendingRows(db)).toHaveLength(0)
    expect(tombstoneRows(db)).toEqual([
      { entity_type: 'schedule', entity_uuid: expect.any(String) },
    ])
  })

  test('re-inserting a synced uuid clears its tombstone', () => {
    db.run("INSERT INTO songs (title) VALUES ('Song')")
    const uuid = db.query<{ uuid: string }, []>('SELECT uuid FROM songs').get()
      ?.uuid as string
    db.run('DELETE FROM songs')
    expect(tombstoneRows(db)).toHaveLength(1)

    db.run("INSERT INTO songs (uuid, title) VALUES (?, 'Song again')", [uuid])

    expect(tombstoneRows(db)).toHaveLength(0)
  })

  test('applying flag suppresses all change tracking', () => {
    db.run('UPDATE sync_state SET applying = 1 WHERE id = 1')

    db.run("INSERT INTO songs (uuid, title) VALUES ('remote-uuid', 'Remote')")
    db.run("UPDATE songs SET title = 'Remote 2'")
    db.run('DELETE FROM songs')

    expect(pendingRows(db)).toHaveLength(0)
    expect(tombstoneRows(db)).toHaveLength(0)

    // A crash mid-apply must not disable tracking forever: boot resets it.
    addSync(db)
    const state = db
      .query<{ applying: number }, []>(
        'SELECT applying FROM sync_state WHERE id = 1',
      )
      .get()
    expect(state?.applying).toBe(0)
  })
})
