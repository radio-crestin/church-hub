import { getRawDatabase } from './connection'
import { rebuildSearchIndex as rebuildBibleSearchIndex } from '../service/bible'
import { rebuildScheduleSearchIndex } from '../service/schedules'
import { rebuildSearchIndex } from '../service/songs'

/**
 * At boot, before any request: rebuilds the search indexes that don't match
 * their tables, on the PC and in a browser's worker alike.
 */
export function rebuildStaleSearchIndexes(
  onProgress?: Parameters<typeof rebuildSearchIndex>[0],
): void {
  // Rebuild FTS indexes BEFORE the HTTP server accepts requests so
  // search never returns empty results during a partial-rebuild window
  // and a previous-launch crash mid-rebuild can't leave the indexes
  // permanently broken (the createFtsTables 'already exist' fast path
  // made that a one-way trap before).
  //
  // To stay fast on subsequent boots we skip the full rebuild when the
  // source-table row count already matches the FTS row count — a sub-
  // millisecond check that's correct for our content schemas (songs,
  // schedules: one FTS row per source row; bible_verses: external-
  // content FTS5 reports source count after a successful rebuild). A
  // mismatch (fresh install, partial seed, schema drift) still
  // triggers the full rebuild.
  try {
    const rawDb = getRawDatabase()
    const count = (sql: string): number => {
      try {
        return Number(
          (rawDb.query<{ c: number }, []>(sql).get()?.c ?? 0) as number,
        )
      } catch {
        return -1
      }
    }
    const songsCount = count('SELECT COUNT(*) AS c FROM songs')
    const songsFtsCount = count('SELECT COUNT(*) AS c FROM songs_fts')
    if (songsFtsCount !== songsCount) {
      // biome-ignore lint/suspicious/noConsole: Startup timing logs
      console.log(
        `[startup] songs FTS out of sync (${songsFtsCount}/${songsCount}) — rebuilding`,
      )
      rebuildSearchIndex(onProgress)
    }
    const schedulesCount = count('SELECT COUNT(*) AS c FROM schedules')
    const schedulesFtsCount = count('SELECT COUNT(*) AS c FROM schedules_fts')
    if (schedulesFtsCount !== schedulesCount) {
      // biome-ignore lint/suspicious/noConsole: Startup timing logs
      console.log(
        `[startup] schedules FTS out of sync (${schedulesFtsCount}/${schedulesCount}) — rebuilding`,
      )
      rebuildScheduleSearchIndex()
    }
    const versesCount = count('SELECT COUNT(*) AS c FROM bible_verses')
    const versesFtsCount = count('SELECT COUNT(*) AS c FROM bible_verses_fts')
    if (versesFtsCount !== versesCount) {
      // biome-ignore lint/suspicious/noConsole: Startup timing logs
      console.log(
        `[startup] bible FTS out of sync (${versesFtsCount}/${versesCount}) — rebuilding`,
      )
      rebuildBibleSearchIndex()
    }
  } catch (rebuildError) {
    // biome-ignore lint/suspicious/noConsole: startup error logging
    console.error('[startup] FTS rebuild failed:', rebuildError)
  }
}
