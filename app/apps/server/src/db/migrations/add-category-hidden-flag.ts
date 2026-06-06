import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-category-hidden-flag:${level}] ${message}`)
}

/**
 * Adds the `is_hidden` flag to `song_categories` (default 0 = visible).
 *
 * A hidden category is NOT deleted: it stays in the database with its songs
 * intact, but it's dropped from the song browser's category filters and its
 * songs are excluded from the song list / search. Admins can re-show it from
 * Settings → Songs. Lets operators hide a whole category (and its songs)
 * without losing any data.
 *
 * Idempotent: only adds the column if it's missing.
 */
export function addCategoryHiddenFlag(db: Database): void {
  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(song_categories)')
    .all()

  if (columns.some((col) => col.name === 'is_hidden')) {
    log('debug', '"is_hidden" already present — nothing to do.')
    return
  }

  log('info', 'Adding "is_hidden" column to song_categories (default 0)...')
  db.run(
    'ALTER TABLE song_categories ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0',
  )
  log('info', 'category is_hidden migration complete')
}
