import type { Database } from 'bun:sqlite'
import { removeFromSearchIndex } from '../../service/songs/search'
import { deleteSong } from '../../service/songs/songs'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[remove-seeded-test-song:${level}] ${message}`)
}

/**
 * A song an e2e run had made, shipped in the default songs from v0.1.97 until
 * T-114. Its title is unique (a timestamp and a random suffix), so only that
 * seeded copy matches.
 */
const SEEDED_TEST_SONG_TITLE = 'E2E Unique Song 1779869811190 e9b5ambhv9n'

/**
 * Deletes the seeded test song from installs that got it on first start, the
 * way the songs page deletes a song (slides, groups, search index; the
 * library sync records the delete). Runs after add_sync for that reason.
 */
export function removeSeededTestSong(db: Database): void {
  const seeded = db
    .query<{ id: number }, [string]>('SELECT id FROM songs WHERE title = ?')
    .all(SEEDED_TEST_SONG_TITLE)
  for (const { id } of seeded) {
    const result = deleteSong(id)
    if (!result.success) throw new Error(result.error)
    removeFromSearchIndex(id)
    log('info', `Removed the seeded test song ${id}`)
  }
}
