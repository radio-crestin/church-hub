import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readBackupContents } from './inspectBackup'
import Database from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

/**
 * Minimal replica of the tables the inspect reader touches. The real schema is
 * a superset; what matters here is that a backup carries programs together with
 * their items.
 */
function createLibraryDb(path: string): Database {
  const db = new Database(path)
  db.run('PRAGMA foreign_keys = ON')
  db.run(`
    CREATE TABLE song_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `)
  db.run(`
    CREATE TABLE songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category_id INTEGER REFERENCES song_categories(id) ON DELETE SET NULL
    )
  `)
  db.run(`
    CREATE TABLE schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE schedule_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      song_id INTEGER REFERENCES songs(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  return db
}

function seedLibrary(db: Database): void {
  db.run(
    "INSERT INTO song_categories (id, name) VALUES (1, 'Resurse Crestine')",
  )
  db.run(
    "INSERT INTO songs (id, title, category_id) VALUES (1, 'Mare esti Tu', 1), (2, 'Slava Domnului', 1), (3, 'Nemarginit', NULL)",
  )
  db.run(
    "INSERT INTO schedules (id, title, created_at) VALUES (1, 'Duminica dimineata', 1700000000), (2, 'Serviciu de seara', 1700086400)",
  )
  // Program 1: two songs with a bible passage between them, deliberately out of
  // insertion order so the sort_order ordering is exercised.
  db.run(`
    INSERT INTO schedule_items (schedule_id, item_type, song_id, sort_order) VALUES
      (1, 'song', 2, 2),
      (1, 'bible_passage', NULL, 1),
      (1, 'song', 1, 0),
      (2, 'song', 3, 0)
  `)
}

describe('backup inspect — programs', () => {
  let dir: string
  let sourcePath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'church-hub-backup-test-'))
    sourcePath = join(dir, 'library.db')
    const db = createLibraryDb(sourcePath)
    seedLibrary(db)
    db.close()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('a copied database still carries the programs and their songs', () => {
    // A backup is a byte-for-byte copy of the database file — the same thing
    // `checkpointAndExport` produces before uploading to Drive.
    const backupPath = join(dir, 'backup.db')
    copyFileSync(sourcePath, backupPath)

    const backup = new Database(backupPath)
    try {
      const contents = readBackupContents(backup)

      expect(contents.counts.schedules).toBe(2)
      expect(contents.counts.scheduleItems).toBe(4)

      const [morning, evening] = contents.schedules
      // Ordered by created_at DESC, so the evening service comes first.
      expect(morning?.title).toBe('Serviciu de seara')
      expect(evening?.title).toBe('Duminica dimineata')

      expect(evening?.itemCount).toBe(3)
      expect(evening?.songCount).toBe(2)
      // Program order, not insertion order.
      expect(evening?.songTitles).toEqual(['Mare esti Tu', 'Slava Domnului'])

      expect(morning?.itemCount).toBe(1)
      expect(morning?.songCount).toBe(1)
      expect(morning?.songTitles).toEqual(['Nemarginit'])
    } finally {
      backup.close()
    }
  })

  test('older backups without schedule_items still report their programs', () => {
    const legacyPath = join(dir, 'legacy.db')
    const legacy = new Database(legacyPath)
    try {
      legacy.run(
        'CREATE TABLE schedules (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, created_at INTEGER NOT NULL)',
      )
      legacy.run(
        "INSERT INTO schedules (title, created_at) VALUES ('Program vechi', 1600000000)",
      )

      const contents = readBackupContents(legacy)
      expect(contents.counts.schedules).toBe(1)
      expect(contents.counts.scheduleItems).toBe(0)
      expect(contents.schedules[0]).toEqual({
        title: 'Program vechi',
        createdAtMs: 1600000000 * 1000,
        itemCount: 0,
        songCount: 0,
        songTitles: [],
      })
    } finally {
      legacy.close()
    }
  })
})
