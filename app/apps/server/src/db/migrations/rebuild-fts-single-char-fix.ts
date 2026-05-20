import type { Database } from 'bun:sqlite'

import { rebuildSearchIndex } from '../../service/songs/search'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrate-fts-single-char:${level}] ${message}`)
}

const MIGRATION_KEY = 'rebuild_fts_single_char_fix_v1'

/**
 * One-shot rebuild of the FTS index after normalizeForIndex was changed to
 * drop single-character tokens.
 *
 * Existing rows in `songs_fts` were tokenized as e.g. "cand isus hristos m a
 * mantuit" — the `m` and `a` between `Hristos` and `mantuit` made it
 * impossible for `calculateTitleScoreNormalized` to detect the user's exact
 * phrase "cand isus hristos mantuit". Rebuilding regenerates every row with
 * the new tokenization.
 *
 * Safe to skip when no songs have been indexed yet (fresh install hitting
 * seedSongs followed by initial index build will already use the fixed
 * normalizer).
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
