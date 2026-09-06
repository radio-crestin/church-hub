import { mergeBiblePassagesIntoVerseteTineri } from './merge-bible-passages-into-versete-tineri'
import Database from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'

/**
 * Minimal replica of the tables the merge touches, with
 * `schedule_versete_tineri_entries` already in its post-0032 shape
 * (`person_name` defaulted instead of required).
 */
function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run('PRAGMA foreign_keys = ON')
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
    CREATE TABLE bible_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      abbreviation TEXT NOT NULL UNIQUE,
      language TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE bible_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      translation_id INTEGER NOT NULL REFERENCES bible_translations(id) ON DELETE CASCADE,
      book_code TEXT NOT NULL,
      book_name TEXT NOT NULL,
      book_order INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE bible_verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      translation_id INTEGER NOT NULL REFERENCES bible_translations(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES bible_books(id) ON DELETE CASCADE,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL
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
      item_type TEXT NOT NULL,
      song_id INTEGER,
      slide_type TEXT,
      slide_content TEXT,
      bible_passage_reference TEXT,
      bible_passage_translation TEXT,
      obs_scene_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  db.run(`
    CREATE TABLE schedule_bible_passage_verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
      verse_id INTEGER NOT NULL,
      reference TEXT NOT NULL,
      text TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  db.run(`
    CREATE TABLE schedule_versete_tineri_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_item_id INTEGER NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
      person_name TEXT NOT NULL DEFAULT '',
      translation_id INTEGER NOT NULL,
      book_code TEXT NOT NULL,
      book_name TEXT NOT NULL,
      reference TEXT NOT NULL,
      text TEXT NOT NULL,
      start_chapter INTEGER NOT NULL,
      start_verse INTEGER NOT NULL,
      end_chapter INTEGER NOT NULL,
      end_verse INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  db.run(
    "INSERT INTO bible_translations (id, name, abbreviation, language) VALUES (1, 'Cornilescu', 'RCCV', 'ro')",
  )
  db.run(
    "INSERT INTO bible_books (id, translation_id, book_code, book_name, book_order) VALUES (1, 1, 'JHN', 'Ioan', 43)",
  )
  db.run(
    `INSERT INTO bible_verses (id, translation_id, book_id, chapter, verse, text) VALUES
       (101, 1, 1, 3, 16, 'Fiindca atat de mult a iubit Dumnezeu lumea'),
       (102, 1, 1, 3, 17, 'Dumnezeu nu Si-a trimis Fiul in lume ca sa judece lumea')`,
  )
  db.run("INSERT INTO schedules (id, title) VALUES (1, 'Duminica')")

  return db
}

function addPassageItem(
  db: Database,
  options: {
    id: number
    reference: string | null
    translation: string | null
    verses: Array<{ verseId: number; reference: string; text: string }>
  },
): void {
  db.run(
    `INSERT INTO schedule_items (id, schedule_id, item_type, bible_passage_reference, bible_passage_translation, sort_order)
     VALUES (?, 1, 'bible_passage', ?, ?, 0)`,
    [options.id, options.reference, options.translation],
  )
  options.verses.forEach((verse, index) => {
    db.run(
      `INSERT INTO schedule_bible_passage_verses (schedule_item_id, verse_id, reference, text, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [options.id, verse.verseId, verse.reference, verse.text, index],
    )
  })
}

interface EntryRow {
  schedule_item_id: number
  person_name: string
  translation_id: number
  book_code: string
  book_name: string
  reference: string
  text: string
  start_chapter: number
  start_verse: number
  end_chapter: number
  end_verse: number
}

function entries(db: Database): EntryRow[] {
  return db
    .query<EntryRow, []>(
      'SELECT * FROM schedule_versete_tineri_entries ORDER BY id',
    )
    .all()
}

describe('mergeBiblePassagesIntoVerseteTineri', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  test('converts a passage using its stored verse ids', () => {
    addPassageItem(db, {
      id: 10,
      reference: 'Ioan 3:16-17 - RCCV',
      translation: 'RCCV',
      verses: [
        { verseId: 101, reference: 'Ioan 3:16', text: 'Fiindca atat' },
        { verseId: 102, reference: 'Ioan 3:17', text: 'Dumnezeu nu' },
      ],
    })

    const result = mergeBiblePassagesIntoVerseteTineri(db)

    expect(result.converted).toBe(1)
    expect(result.skipped).toEqual([])

    const item = db
      .query<
        {
          item_type: string
          slide_type: string | null
          bible_passage_reference: string | null
          bible_passage_translation: string | null
        },
        []
      >('SELECT * FROM schedule_items WHERE id = 10')
      .get()
    expect(item?.item_type).toBe('slide')
    expect(item?.slide_type).toBe('versete_tineri')
    expect(item?.bible_passage_reference).toBeNull()
    expect(item?.bible_passage_translation).toBeNull()

    const [entry] = entries(db)
    expect(entry?.person_name).toBe('')
    expect(entry?.translation_id).toBe(1)
    expect(entry?.book_code).toBe('JHN')
    expect(entry?.book_name).toBe('Ioan')
    expect(entry?.reference).toBe('Ioan 3:16-17')
    // The whole passage becomes one block of text, verse order preserved.
    expect(entry?.text).toBe('Fiindca atat Dumnezeu nu')
    expect(entry?.start_chapter).toBe(3)
    expect(entry?.start_verse).toBe(16)
    expect(entry?.end_chapter).toBe(3)
    expect(entry?.end_verse).toBe(17)

    // The now-migrated verse rows are gone; the entry carries the passage.
    const verseCount = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM schedule_bible_passage_verses',
      )
      .get()
    expect(verseCount?.count).toBe(0)
  })

  test('falls back to the display reference when the verse ids are foreign', () => {
    addPassageItem(db, {
      id: 11,
      reference: 'Ioan 3:16 - RCCV',
      translation: 'RCCV',
      // Ids from another machine's Bible import.
      verses: [{ verseId: 99999, reference: 'Ioan 3:16', text: '' }],
    })

    const result = mergeBiblePassagesIntoVerseteTineri(db)

    expect(result.converted).toBe(1)
    const [entry] = entries(db)
    expect(entry?.reference).toBe('Ioan 3:16')
    expect(entry?.translation_id).toBe(1)
    expect(entry?.text).toBe('Fiindca atat de mult a iubit Dumnezeu lumea')
  })

  test('leaves an unconvertible passage untouched and reports it', () => {
    addPassageItem(db, {
      id: 12,
      reference: 'Ioan 3:16 - KJV',
      translation: 'KJV',
      verses: [{ verseId: 99999, reference: 'Ioan 3:16', text: 'For God' }],
    })

    const result = mergeBiblePassagesIntoVerseteTineri(db)

    expect(result.converted).toBe(0)
    expect(result.skipped).toEqual([
      {
        itemId: 12,
        scheduleId: 1,
        reference: 'Ioan 3:16 - KJV',
        reason: 'unknown_translation',
      },
    ])

    const item = db
      .query<{ item_type: string }, []>(
        'SELECT item_type FROM schedule_items WHERE id = 12',
      )
      .get()
    expect(item?.item_type).toBe('bible_passage')
    expect(entries(db)).toHaveLength(0)
    // The original verse rows must survive, untouched.
    const verseCount = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM schedule_bible_passage_verses',
      )
      .get()
    expect(verseCount?.count).toBe(1)
  })

  test('leaves a reference it cannot parse untouched, and still converts the rest', () => {
    // Malformed display reference with verse ids that resolve nowhere.
    addPassageItem(db, {
      id: 14,
      reference: 'nonsense',
      translation: 'RCCV',
      verses: [{ verseId: 99999, reference: 'nonsense', text: 'whatever' }],
    })
    // No reference at all and no verse rows to fall back on.
    db.run(
      `INSERT INTO schedule_items (id, schedule_id, item_type, sort_order)
       VALUES (15, 1, 'bible_passage', 1)`,
    )
    // A healthy passage in the same run.
    addPassageItem(db, {
      id: 16,
      reference: 'Ioan 3:16 - RCCV',
      translation: 'RCCV',
      verses: [{ verseId: 101, reference: 'Ioan 3:16', text: 'Fiindca atat' }],
    })

    const result = mergeBiblePassagesIntoVerseteTineri(db)

    expect(result.converted).toBe(1)
    expect(result.skipped).toEqual([
      {
        itemId: 14,
        scheduleId: 1,
        reference: 'nonsense',
        reason: 'unparsable_reference',
      },
      {
        itemId: 15,
        scheduleId: 1,
        reference: null,
        reason: 'no_reference',
      },
    ])

    const types = db
      .query<{ id: number; item_type: string }, []>(
        'SELECT id, item_type FROM schedule_items WHERE id IN (14, 15, 16) ORDER BY id',
      )
      .all()
    expect(types).toEqual([
      { id: 14, item_type: 'bible_passage' },
      { id: 15, item_type: 'bible_passage' },
      { id: 16, item_type: 'slide' },
    ])

    // Only the healthy passage produced an entry.
    expect(entries(db)).toHaveLength(1)
    expect(entries(db)[0]?.schedule_item_id).toBe(16)

    // The unconvertible rows keep their own data, so a later boot can retry.
    const kept = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM schedule_bible_passage_verses WHERE schedule_item_id = 14',
      )
      .get()
    expect(kept?.count).toBe(1)
  })

  test('retries the skipped rows on the next boot instead of marking itself done', () => {
    addPassageItem(db, {
      id: 17,
      reference: 'Ioan 3:16 - KJV',
      translation: 'KJV',
      verses: [{ verseId: 99999, reference: 'Ioan 3:16', text: 'For God' }],
    })

    expect(mergeBiblePassagesIntoVerseteTineri(db).skipped).toHaveLength(1)

    // The translation shows up later (the user imports it).
    db.run(
      "INSERT INTO bible_translations (id, name, abbreviation, language) VALUES (2, 'King James', 'KJV', 'en')",
    )
    db.run(
      "INSERT INTO bible_books (id, translation_id, book_code, book_name, book_order) VALUES (2, 2, 'JHN', 'Ioan', 43)",
    )
    db.run(
      "INSERT INTO bible_verses (id, translation_id, book_id, chapter, verse, text) VALUES (201, 2, 2, 3, 16, 'For God so loved the world')",
    )

    const second = mergeBiblePassagesIntoVerseteTineri(db)
    expect(second.converted).toBe(1)
    expect(second.skipped).toEqual([])
    expect(entries(db)[0]?.text).toBe('For God so loved the world')
  })

  test('is idempotent', () => {
    addPassageItem(db, {
      id: 13,
      reference: 'Ioan 3:16 - RCCV',
      translation: 'RCCV',
      verses: [{ verseId: 101, reference: 'Ioan 3:16', text: 'Fiindca atat' }],
    })

    expect(mergeBiblePassagesIntoVerseteTineri(db).converted).toBe(1)
    const after = entries(db)

    expect(mergeBiblePassagesIntoVerseteTineri(db).converted).toBe(0)
    expect(entries(db)).toEqual(after)
  })

  test('is a no-op on a database without bible_passage items', () => {
    const result = mergeBiblePassagesIntoVerseteTineri(db)

    expect(result).toEqual({ converted: 0, skipped: [] })
    const flag = db
      .query<{ value: string }, []>(
        "SELECT value FROM app_settings WHERE key = 'merge_bible_passages_into_versete_tineri_v1'",
      )
      .get()
    expect(flag?.value).toBeDefined()
  })

  test('keeps existing versete tineri entries and their person names', () => {
    db.run(
      "INSERT INTO schedule_items (id, schedule_id, item_type, slide_type, sort_order) VALUES (20, 1, 'slide', 'versete_tineri', 1)",
    )
    db.run(
      `INSERT INTO schedule_versete_tineri_entries (
         schedule_item_id, person_name, translation_id, book_code, book_name,
         reference, text, start_chapter, start_verse, end_chapter, end_verse, sort_order
       ) VALUES (20, 'Andrei', 1, 'JHN', 'Ioan', 'Ioan 3:16', 'Fiindca atat', 3, 16, 3, 16, 0)`,
    )

    mergeBiblePassagesIntoVerseteTineri(db)

    const [entry] = entries(db)
    expect(entry?.person_name).toBe('Andrei')
  })
})
