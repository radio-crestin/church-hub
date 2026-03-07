import Database from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Real app database for benchmarking (only available locally)
const DB_PATH = resolve(
  import.meta.dir,
  '../../../../../data/app-v0.1.40.db',
)

const hasDb = existsSync(DB_PATH)

function openDb() {
  return new Database(DB_PATH, { readonly: true })
}

// Create an in-memory fixture DB with sample verses for CI
function createFixtureDb(): Database {
  const db = new Database(':memory:')
  db.run(`
    CREATE TABLE bible_books (
      id INTEGER PRIMARY KEY,
      book_name TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE bible_verses (
      id INTEGER PRIMARY KEY,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES bible_books(id)
    )
  `)
  db.run(`
    CREATE VIRTUAL TABLE bible_verses_fts USING fts5(text, content='bible_verses', content_rowid='id')
  `)

  // Insert sample books
  db.run(`INSERT INTO bible_books (id, book_name) VALUES (1, 'Geneza')`)
  db.run(`INSERT INTO bible_books (id, book_name) VALUES (2, 'Ioan')`)
  db.run(`INSERT INTO bible_books (id, book_name) VALUES (3, 'Romani')`)
  db.run(`INSERT INTO bible_books (id, book_name) VALUES (4, 'Psalmi')`)

  // Insert sample verses
  const verses = [
    [1, 1, 1, 1, 'La inceput, Dumnezeu a facut cerurile si pamantul.'],
    [2, 1, 1, 2, 'Pamantul era pustiu si gol; peste fata adancului de ape era intuneric.'],
    [3, 2, 3, 16, 'Fiindca atat de mult a iubit Dumnezeu lumea, ca a dat pe singurul Lui Fiu.'],
    [4, 2, 1, 1, 'La inceput era Cuvantul, si Cuvantul era cu Dumnezeu, si Cuvantul era Dumnezeu.'],
    [5, 2, 14, 6, 'Isus a zis: Eu sunt Calea, Adevarul si Viata.'],
    [6, 3, 8, 28, 'De altfel, stim ca toate lucrurile lucreaza impreuna spre binele celor ce iubesc pe Dumnezeu.'],
    [7, 3, 5, 8, 'Dumnezeu isi arata dragostea fata de noi prin faptul ca Isus a murit pentru noi.'],
    [8, 4, 23, 1, 'Domnul este Pastorul meu: nu voi duce lipsa de nimic.'],
    [9, 2, 11, 35, 'Isus a plans. O zi de tristete si durere.'],
    [10, 4, 119, 105, 'Cuvantul Tau este o lumina pentru picioarele mele si o lumina pe cararea mea.'],
    [11, 3, 12, 12, 'Bucurati-va in nadejde. Fiti rabdatori in necaz. Staruiti in rugaciune.'],
    [12, 2, 8, 32, 'Veti cunoaste adevarul si adevarul va va face liberi.'],
  ]

  const insertStmt = db.prepare('INSERT INTO bible_verses (id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)')
  const insertFts = db.prepare('INSERT INTO bible_verses_fts (rowid, text) VALUES (?, ?)')
  for (const v of verses) {
    insertStmt.run(...v)
    insertFts.run(v[0], v[4])
  }

  return db
}

function checkFtsIndex(db: Database) {
  const count = db
    .query<{ count: number }, []>(
      'SELECT COUNT(*) as count FROM bible_verses_fts',
    )
    .get()
  return count?.count ?? 0
}

function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function generateFuzzyFtsQuery(words: string[]): string {
  if (words.length === 1) return `${words[0]}*`
  const completed = words.slice(0, -1)
  const lastWord = words[words.length - 1]
  return [...completed, `${lastWord}*`].join(' ')
}

function sanitizeAndBuildQuery(query: string): {
  ftsQuery: string
  words: string[]
} {
  const sanitized = removeDiacritics(query)
    .replace(/['"]/g, '')
    .replace(/[*()]/g, ' ')
    .trim()
  // Filter out single-character words (fix for slow "o*" prefix queries)
  const words = sanitized.split(/\s+/).filter((w) => w.length >= 2)
  return { ftsQuery: generateFuzzyFtsQuery(words), words }
}

function searchBible(
  db: Database,
  query: string,
  limit = 30,
): { results: unknown[]; elapsed: number } {
  const { ftsQuery, words } = sanitizeAndBuildQuery(query)
  if (words.length === 0) return { results: [], elapsed: 0 }

  const stmt = db.prepare(`
    SELECT v.id, v.book_id, b.book_name, v.chapter, v.verse, v.text
    FROM (
      SELECT rowid AS rid, bm25(bible_verses_fts) AS rank
      FROM bible_verses_fts
      WHERE bible_verses_fts MATCH $query
      ORDER BY bm25(bible_verses_fts)
      LIMIT $limit * 5
    ) fts
    JOIN bible_verses v ON v.id = fts.rid
    JOIN bible_books b ON b.id = v.book_id
    ORDER BY fts.rank
    LIMIT $limit
  `)

  const start = performance.now()
  const results = stmt.all({ $query: ftsQuery, $limit: limit })
  const elapsed = performance.now() - start

  return { results: results as unknown[], elapsed }
}

// Helper to get a DB - uses real DB if available, otherwise fixture
function getTestDb(): Database {
  return hasDb ? openDb() : createFixtureDb()
}

describe('Bible FTS Index', () => {
  test('FTS index has verses indexed', () => {
    const db = getTestDb()
    const count = checkFtsIndex(db)
    expect(count).toBeGreaterThan(0)
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(`FTS index contains ${count} verses`)
    db.close()
  })

  test('FTS index verse count matches bible_verses table', () => {
    const db = getTestDb()
    const ftsCount = db
      .query<{ c: number }, []>('SELECT COUNT(*) as c FROM bible_verses_fts')
      .get()!.c
    const tableCount = db
      .query<{ c: number }, []>('SELECT COUNT(*) as c FROM bible_verses')
      .get()!.c
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(`FTS: ${ftsCount} verses, Table: ${tableCount} verses`)
    expect(ftsCount).toBe(tableCount)
    db.close()
  })
})

describe('Bible Search', () => {
  test('search returns matching results', () => {
    const db = getTestDb()
    const { results } = searchBible(db, 'Isus a zis')
    expect(results.length).toBeGreaterThan(0)
    db.close()
  })

  test('search for "Dumnezeu" returns results', () => {
    const db = getTestDb()
    const { results } = searchBible(db, 'Dumnezeu')
    expect(results.length).toBeGreaterThan(0)
    db.close()
  })

  test('search for "Fiindca atat de mult" returns results', () => {
    const db = getTestDb()
    const { results } = searchBible(db, 'Fiindca atat de mult')
    expect(results.length).toBeGreaterThan(0)
    db.close()
  })

  test('search for "Domnul este Pastorul" returns results', () => {
    const db = getTestDb()
    const { results } = searchBible(db, 'Domnul este Pastorul')
    expect(results.length).toBeGreaterThan(0)
    db.close()
  })

  test('single-character queries return empty (stop word filtering)', () => {
    const { words } = sanitizeAndBuildQuery('o')
    expect(words).toEqual([])
    const { words: words2 } = sanitizeAndBuildQuery('a e i o')
    expect(words2).toEqual([])
  })

  test('problematic prefix "o*" is excluded from FTS query', () => {
    // "O zi Isus" should generate "zi Isus*" not "NEAR(o* zi* isus*, 10)"
    const { ftsQuery } = sanitizeAndBuildQuery('O zi Isus')
    expect(ftsQuery).toBe('zi Isus*')
    expect(ftsQuery).not.toContain('O*')
  })

  test('both "O zi Isus " and "O zi Isus" produce same FTS query', () => {
    const q1 = sanitizeAndBuildQuery('O zi Isus ')
    const q2 = sanitizeAndBuildQuery('O zi Isus')
    expect(q1.ftsQuery).toBe(q2.ftsQuery)
    expect(q1.words).toEqual(q2.words)
  })
})

describe.skipIf(!hasDb)('Bible Search Performance (real DB)', () => {
  test('"O zi Isus " (with trailing space) completes under 100ms', () => {
    const db = openDb()
    const { results, elapsed } = searchBible(db, 'O zi Isus ')
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(
      `"O zi Isus " → ${results.length} results in ${elapsed.toFixed(1)}ms`,
    )
    expect(results.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
    db.close()
  })

  test('"O zi Isus" (without trailing space) completes under 100ms', () => {
    const db = openDb()
    const { results, elapsed } = searchBible(db, 'O zi Isus')
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(
      `"O zi Isus" → ${results.length} results in ${elapsed.toFixed(1)}ms`,
    )
    expect(results.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
    db.close()
  })

  test('common searches complete under 100ms', () => {
    const db = openDb()
    const queries = [
      'Isus a zis',
      'Dumnezeu este dragoste',
      'credinta nadejde',
      'in inceput era',
      'domnul este pastorul',
    ]

    for (const q of queries) {
      const { results, elapsed } = searchBible(db, q)
      // biome-ignore lint/suspicious/noConsole: test output
      console.log(`"${q}" → ${results.length} results in ${elapsed.toFixed(1)}ms`)
      expect(elapsed).toBeLessThan(100)
      expect(results.length).toBeGreaterThan(0)
    }
    db.close()
  })

  test('short prefix queries complete under 200ms', () => {
    const db = openDb()
    const queries = ['zi', 'Is', 'cr']

    for (const q of queries) {
      const { results, elapsed } = searchBible(db, q)
      // biome-ignore lint/suspicious/noConsole: test output
      console.log(`"${q}" → ${results.length} results in ${elapsed.toFixed(1)}ms`)
      expect(elapsed).toBeLessThan(200)
    }
    db.close()
  })

  test('"Fiindca atat de mult" completes under 100ms', () => {
    const db = openDb()
    const { results, elapsed } = searchBible(db, 'Fiindca atat de mult')
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(
      `"Fiindca atat de mult" → ${results.length} results in ${elapsed.toFixed(1)}ms`,
    )
    expect(results.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
    db.close()
  })

  test('BENCHMARK: fixed query vs old slow query with o* prefix', () => {
    const db = openDb()

    const stmtFixed = db.prepare(`
      SELECT v.id, v.book_id, b.book_name, v.chapter, v.verse, v.text
      FROM (
        SELECT rowid AS rid, bm25(bible_verses_fts) AS rank
        FROM bible_verses_fts
        WHERE bible_verses_fts MATCH $query
        ORDER BY bm25(bible_verses_fts)
        LIMIT 150
      ) fts
      JOIN bible_verses v ON v.id = fts.rid
      JOIN bible_books b ON b.id = v.book_id
      ORDER BY fts.rank
      LIMIT 30
    `)

    // Fixed: "zi Isus*" (prefix only on last word)
    const fixedStart = performance.now()
    const fixedResults = stmtFixed.all({ $query: 'zi Isus*' })
    const fixedElapsed = performance.now() - fixedStart

    // Old (slow): NEAR(O* zi* Isus*, 10) - all words with prefix + NEAR
    const oldStart = performance.now()
    const oldResults = stmtFixed.all({ $query: 'NEAR(O* zi* Isus*, 10)' })
    const oldElapsed = performance.now() - oldStart

    // biome-ignore lint/suspicious/noConsole: benchmark output
    console.log(`\n  BENCHMARK "O zi Isus":`)
    // biome-ignore lint/suspicious/noConsole: benchmark output
    console.log(`    OLD (NEAR+all prefix): ${oldElapsed.toFixed(1)}ms (${(oldResults as unknown[]).length} results)`)
    // biome-ignore lint/suspicious/noConsole: benchmark output
    console.log(`    NEW (last prefix):     ${fixedElapsed.toFixed(1)}ms (${(fixedResults as unknown[]).length} results)`)
    // biome-ignore lint/suspicious/noConsole: benchmark output
    console.log(`    Speedup:               ${(oldElapsed / fixedElapsed).toFixed(1)}x`)

    expect(fixedElapsed).toBeLessThan(100)
    db.close()
  })
})
