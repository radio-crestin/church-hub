// biome-ignore-all lint/suspicious/noConsole: a command-line script reports on stdout
/**
 * The first sync's steps natively in Bun, timed one by one, to compare with the
 * same code in the browser worker:
 *   bun spikes/cloud-sync/scripts/profileApply.ts <snapshot.json.gz> <work-dir>
 * Runs on a fresh db file in <work-dir> (deleted afterwards).
 */
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const [snapshot, workDir] = process.argv.slice(2)
if (!snapshot || !workDir) {
  throw new Error('usage: profileApply.ts <snapshot.json.gz> <work-dir>')
}
mkdirSync(workDir, { recursive: true })
process.env.DATABASE_PATH = join(workDir, `profile-${Date.now()}.db`)

// Seed no fixtures (26k songs, Bibles), as on a phone: the browser build's shim.
Bun.plugin({
  name: 'no-fixtures',
  setup(build) {
    build.onLoad(
      { filter: /db[\\/]fixtures[\\/]readFixtureFile\.ts$/ },
      () => ({
        contents: 'export function readFixtureFile() { return [] }',
        loader: 'ts',
      }),
    )
  },
})

const server = '../../../apps/server/src'
const { initializeDatabase, getRawDatabase } = await import(`${server}/db`)
const { getSyncState } = await import(`${server}/service/sync/syncStateStore`)
const { adoptRemoteIdentities } = await import(
  `${server}/service/sync/adoptRemoteIdentities`
)
const { serializeLibrary } = await import(
  `${server}/service/sync/serializeLibrary`
)
const { mergeLibraries } = await import(`${server}/service/sync/mergeLibraries`)
const { applyRemoteChanges } = await import(
  `${server}/service/sync/applyRemoteChanges`
)
const { rebuildSearchIndex } = await import(`${server}/service/songs/search`)

const times: Record<string, number> = {}
function step<T>(name: string, fn: () => T): T {
  const start = performance.now()
  const value = fn()
  times[name] = Math.round(performance.now() - start)
  return value
}

await initializeDatabase()
const gz = await Bun.file(snapshot).bytes()
const remote = step('gunzipParse', () =>
  JSON.parse(new TextDecoder().decode(Bun.gunzipSync(gz))),
)
const state = getSyncState()
step('adopt', () => adoptRemoteIdentities(remote))
const local = step('serializeLocal', () =>
  serializeLibrary(state.deviceId, state.deviceName, new Set()),
)
const { applyOps } = step('merge', () =>
  mergeLibraries(local, remote, new Set(), Math.floor(Date.now() / 1000)),
)
step('apply', () => applyRemoteChanges(applyOps))
// The apply indexes every song itself; the rebuild after it is only timed.
const indexed = getRawDatabase()
  .query('SELECT count(DISTINCT song_id) AS n FROM songs_fts')
  .get()
step('ftsRebuild', () => rebuildSearchIndex())
const songs = getRawDatabase().query('SELECT count(*) AS n FROM songs').get()
console.log(JSON.stringify({ ops: applyOps.length, songs, indexed, times }))
try {
  getRawDatabase().close()
  rmSync(workDir, { recursive: true, force: true })
} catch (error) {
  console.warn(`left ${workDir} behind: ${(error as Error).message}`)
}
