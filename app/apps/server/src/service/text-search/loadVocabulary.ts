import type { Vocabulary } from './types'
import type { Database } from 'bun:sqlite'

/**
 * Reads every word of an FTS5 index with its document count, through an
 * `fts5vocab` table in the connection's temp schema (nothing is written to
 * the database file). Sorted so `findSimilarTerms` can walk it as a trie.
 */
export function loadVocabulary(db: Database, ftsTable: string): Vocabulary {
  const vocabTable = `temp.${ftsTable}_vocab`
  db.run(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${vocabTable} USING fts5vocab(main, ${ftsTable}, row)`,
  )
  const rows = db
    .query<{ term: string; doc: number }, []>(
      `SELECT term, doc FROM ${vocabTable}`,
    )
    .all()
  rows.sort((a, b) => (a.term < b.term ? -1 : a.term > b.term ? 1 : 0))
  const documentCount =
    db.query<{ c: number }, []>(`SELECT COUNT(*) AS c FROM ${ftsTable}`).get()
      ?.c ?? 0
  return {
    terms: rows.map((row) => row.term),
    docCounts: rows.map((row) => row.doc),
    documentCount,
  }
}
