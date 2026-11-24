import type { Database } from 'bun:sqlite'

/**
 * Bible verses by topic: each topic is a list of verse references (book code,
 * chapter, verse range) as JSON, never verse text, so it works with every
 * installed translation. `fixture_hash` is the hash of the bundled content
 * last written; a row whose content no longer matches it was changed by the
 * user, and the seed leaves it alone. Idempotent.
 */
export function addBibleTopics(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS bible_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_ro TEXT NOT NULL,
      verse_references TEXT NOT NULL,
      fixture_hash TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
}
