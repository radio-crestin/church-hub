// biome-ignore-all lint/suspicious/noConsole: a command-line script reports on stdout
/**
 * The bench's first sync and searches natively, on Bun and bun:sqlite (the
 * desktop app's engine), as the baseline for the browser numbers:
 *   bun spikes/cloud-sync/scripts/nativeBaseline.ts <snapshot.json.gz>
 * Same code, same snapshot; the db is a fresh file in a temp dir whose seeded
 * songs are removed before the sync (a phone seeds none).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { QUERIES } from '../src/queries'

const [snapshotPath] = process.argv.slice(2)
if (!snapshotPath)
  throw new Error('usage: nativeBaseline.ts <snapshot.json.gz>')

const work = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'native-'))
process.env.DATABASE_PATH = join(work, 'app.db')

const { initializeDatabase, closeDatabase, getRawDatabase } = await import(
  '../../../apps/server/src/db'
)
const { rebuildSearchIndex, clearSearchCache } = await import(
  '../../../apps/server/src/service/songs/search'
)
const { searchSongs } = await import(
  '../../../apps/server/src/service/songs/song-search/searchSongs'
)
const { applySnapshot } = await import('../src/applySnapshot')

const results: Record<string, unknown> = { engine: `bun ${Bun.version}` }
const time = <T>(name: string, fn: () => T): T => {
  const start = performance.now()
  const value = fn()
  results[name] = Math.round(performance.now() - start)
  return value
}

await initializeDatabase()
getRawDatabase().exec(
  `DELETE FROM songs; DELETE FROM song_groups; DELETE FROM songs_fts;
   DELETE FROM sync_pending; DELETE FROM sync_tombstones; DELETE FROM sync_updates;`,
)
const remote = time('gunzipParse', () =>
  JSON.parse(
    new TextDecoder().decode(Bun.gunzipSync(readFileSync(snapshotPath))),
  ),
)
const applied = time('syncApply', () => applySnapshot(remote))
results.phases = applied.phases
time('ftsRebuild', () => rebuildSearchIndex())

const perQuery: Record<string, number> = {}
for (const query of QUERIES) {
  const runs: number[] = []
  for (let i = 0; i < 5; i++) {
    clearSearchCache()
    const start = performance.now()
    searchSongs(query, undefined, 50)
    runs.push(performance.now() - start)
  }
  perQuery[query] = Math.round(runs.sort((a, b) => a - b)[2] * 10) / 10
}
const medians = Object.values(perQuery).sort((a, b) => a - b)
results.search = { medianMs: medians[Math.floor(medians.length / 2)], perQuery }

closeDatabase()
rmSync(work, { recursive: true, force: true })
console.log(JSON.stringify(results))
