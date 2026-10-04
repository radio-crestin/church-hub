import { convertBibleBookmarkStylesToMarkdown } from './convert-bible-bookmark-styles-to-markdown'
import Database from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'

const VERSE = 'Fiindcă atât de mult a iubit Dumnezeu lumea'

/** The table as it stood after 0031, with one styled and one plain verse. */
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
    CREATE TABLE bible_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      style_ranges TEXT
    )
  `)
  const ranges = [
    { id: 'h', start: 29, end: 37, highlight: '#FFFF00' },
    { id: 'u', start: 38, end: 43, underline: true },
    { id: 'b', start: 0, end: 7, bold: true },
  ]
  db.run('INSERT INTO bible_bookmarks (text, style_ranges) VALUES (?, ?)', [
    VERSE,
    JSON.stringify(ranges),
  ])
  db.run('INSERT INTO bible_bookmarks (text, style_ranges) VALUES (?, NULL)', [
    'Domnul este Păstorul meu',
  ])
  db.run('INSERT INTO bible_bookmarks (text, style_ranges) VALUES (?, ?)', [
    'Text cu JSON stricat',
    '{not json',
  ])
  return db
}

function columns(db: Database): string[] {
  return db
    .query<{ name: string }, []>('PRAGMA table_info(bible_bookmarks)')
    .all()
    .map((column) => column.name)
}

function markdownRows(db: Database): string[] {
  return db
    .query<{ markdown: string }, []>(
      'SELECT markdown FROM bible_bookmarks ORDER BY id',
    )
    .all()
    .map((row) => row.markdown)
}

describe('convertBibleBookmarkStylesToMarkdown', () => {
  test('keeps every saved style as Markdown and drops the JSON column', () => {
    const db = createTestDb()
    convertBibleBookmarkStylesToMarkdown(db)

    expect(columns(db)).toContain('markdown')
    expect(columns(db)).not.toContain('style_ranges')
    expect(markdownRows(db)).toEqual([
      '**Fiindcă** atât de mult a iubit <mark>Dumnezeu</mark> <u>lumea</u>',
      'Domnul este Păstorul meu',
      'Text cu JSON stricat',
    ])
  })

  test('is idempotent, with or without the applied marker', () => {
    const db = createTestDb()
    convertBibleBookmarkStylesToMarkdown(db)
    const first = markdownRows(db)

    db.run(
      "DELETE FROM app_settings WHERE key = 'convert_bible_bookmark_styles_to_markdown_v1'",
    )
    expect(() => convertBibleBookmarkStylesToMarkdown(db)).not.toThrow()
    expect(markdownRows(db)).toEqual(first)
  })
})
