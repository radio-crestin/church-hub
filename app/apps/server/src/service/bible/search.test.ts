import Database from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { resolve } from 'path'

// Use the real app database for benchmarking
const DB_PATH = resolve(
  import.meta.dir,
  '../../../../../data/app-v0.1.40.db',
)

function openDb() {
  return new Database(DB_PATH, { readonly: true })
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

describe('Bible FTS Index', () => {
  test('FTS index has verses indexed', () => {
    const db = openDb()
    const count = checkFtsIndex(db)
    expect(count).toBeGreaterThan(0)
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(`FTS index contains ${count} verses`)
    db.close()
  })

  test('FTS index verse count matches bible_verses table', () => {
    const db = openDb()
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

describe('Bible Search Performance', () => {
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

  test('single-character queries return empty (stop word filtering)', () => {
    const { words } = sanitizeAndBuildQuery('o')
    expect(words).toEqual([])
    const { words: words2 } = sanitizeAndBuildQuery('a e i o')
    expect(words2).toEqual([])
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
