import { enableScreensAlwaysOnTop } from './enable-screens-always-on-top'
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
    CREATE TABLE screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      always_on_top INTEGER NOT NULL DEFAULT 0
    )
  `)
  db.run("INSERT INTO screens (name) VALUES ('Main'), ('Stage')")
  return db
}

function alwaysOnTopByName(db: Database): Record<string, number> {
  const rows = db
    .query<{ name: string; always_on_top: number }, []>(
      'SELECT name, always_on_top FROM screens',
    )
    .all()
  return Object.fromEntries(rows.map((row) => [row.name, row.always_on_top]))
}

describe('enableScreensAlwaysOnTop', () => {
  test('puts every existing screen on top', () => {
    const db = createTestDb()
    enableScreensAlwaysOnTop(db)
    expect(alwaysOnTopByName(db)).toEqual({ Main: 1, Stage: 1 })
  })

  test('runs once, so a screen turned off afterwards stays off', () => {
    const db = createTestDb()
    enableScreensAlwaysOnTop(db)
    db.run("UPDATE screens SET always_on_top = 0 WHERE name = 'Stage'")

    enableScreensAlwaysOnTop(db)

    expect(alwaysOnTopByName(db)).toEqual({ Main: 1, Stage: 0 })
  })
})
