import { getRawDatabase } from './connection'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[fts:${level}] ${message}`)
}

/**
 * Creates FTS5 virtual tables
 * These cannot be created via Drizzle schema - must be raw SQL
 */
export function createFtsTables(): void {
  const db = getRawDatabase()

  log('info', 'Creating FTS5 virtual tables...')

  // Songs FTS (standard tokenizer for accent-insensitive search)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
      song_id UNINDEXED,
      title,
      category_name,
      content,
      tokenize='unicode61 remove_diacritics 2'
    );
  `)

  // Songs FTS with trigram for fuzzy/partial matching
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts_trigram USING fts5(
      song_id UNINDEXED,
      title,
      content,
      tokenize='trigram'
    );
  `)

  // Schedules FTS
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS schedules_fts USING fts5(
      schedule_id UNINDEXED,
      title,
      description,
      song_titles,
      song_content,
      tokenize='unicode61 remove_diacritics 2'
    );
  `)

  // Bible verses FTS (content table for external content)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS bible_verses_fts USING fts5(
      text,
      content=bible_verses,
      content_rowid=id,
      tokenize='unicode61 remove_diacritics 2'
    );
  `)

  log('info', 'FTS5 virtual tables created')
}

/**
 * Raw FTS search helper - executes FTS MATCH queries
 */
export function searchFts<T>(
  tableName: string,
  matchQuery: string,
  selectColumns: string,
  limit = 50,
): T[] {
  const db = getRawDatabase()
  const stmt = db.query(`
    SELECT ${selectColumns}
    FROM ${tableName}
    WHERE ${tableName} MATCH ?
    ORDER BY rank
    LIMIT ?
  `)
  return stmt.all(matchQuery, limit) as T[]
}
