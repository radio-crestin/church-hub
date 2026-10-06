import type { Database } from 'bun:sqlite'

/**
 * The trigram index of the songs fed the old fuzzy search phase. Typos are
 * now found through the vocabulary of `songs_fts` (T-128), so the second
 * copy of every song's text goes.
 */
export function dropSongsTrigramIndex(db: Database): void {
  db.run('DROP TABLE IF EXISTS songs_fts_trigram')
}
