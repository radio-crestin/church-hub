import type { Database } from 'bun:sqlite'
import { rebuildSearchIndex } from '../../service/songs/search'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrate-fts-single-char:${level}] ${message}`)
}

// Bump the key whenever normalizeForIndex changes what it emits — every
// existing database then re-indexes once on its next boot.
//
// v2: the v1 rebuild dropped single-char tokens from the index ("cand isus
//     hristos m a mantuit" → "cand isus hristos mantuit"), which lost
//     linguistic signal for Romanian clitics; v2 reinstated them.
// v3: HTML entities in slide content are decoded (an escaped apostrophe
//     used to index as a stray "039" that split phrases), and every
//     hyphen/apostrophe word is also indexed in its joined spellings so
//     "ne-ncetat", "ne'ncetat", "nencetat" and "neîncetat" find each other.
const MIGRATION_KEY = 'rebuild_fts_word_spellings_v3'

/**
 * Re-runs rebuildSearchIndex once with the current normalizeForIndex so the
 * FTS table reflects the source-of-truth tokenisation rules. Skipped on
 * subsequent boots via the app_settings flag.
 */
export function rebuildFtsForSingleCharFix(db: Database): void {
  const applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (applied && applied > 0) {
    log('debug', 'FTS single-char rebuild already applied, skipping')
    return
  }

  const ftsRowCount = db
    .query<{ count: number }, []>('SELECT COUNT(*) as count FROM songs_fts')
    .get()?.count

  if (!ftsRowCount || ftsRowCount === 0) {
    log('info', 'FTS index empty, nothing to rebuild — marking complete')
    markComplete(db, { rebuilt: false, reason: 'empty_index' })
    return
  }

  log('info', `Rebuilding FTS index for ${ftsRowCount} song row(s)...`)
  rebuildSearchIndex()
  log('info', 'FTS rebuild complete')
  markComplete(db, { rebuilt: true, rowCount: ftsRowCount })
}

function markComplete(
  db: Database,
  result: { rebuilt: boolean; rowCount?: number; reason?: string },
): void {
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify(result)],
  )
}
