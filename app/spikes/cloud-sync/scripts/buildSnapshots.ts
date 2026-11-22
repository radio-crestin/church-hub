// biome-ignore-all lint/suspicious/noConsole: a command-line script reports on stdout
/**
 * Builds the spike's gzipped LibraryFile snapshots from a real app.db, with
 * the server's own serializeLibrary (the format the Drive sync writes):
 *   bun spikes/cloud-sync/scripts/buildSnapshots.ts <app.db> <out-dir> [songs...]
 * One snapshot per size (default: all songs and 3000), named
 * snapshot-<size>.json.gz ("27k" for the whole library when it is that big).
 * The db is copied first (VACUUM INTO): the source is never written.
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { Database } from 'bun:sqlite'

const [source, outDir, ...sizeArgs] = process.argv.slice(2)
if (!source || !outDir) {
  throw new Error('usage: buildSnapshots.ts <app.db> <out-dir> [songs...]')
}

const work = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'snapshot-'))
const copy = join(work, 'app.db')
new Database(source, { readonly: true }).run(`VACUUM INTO '${copy}'`)
process.env.DATABASE_PATH = copy

const { initializeDatabase, closeDatabase } = await import(
  '../../../apps/server/src/db'
)
const { serializeLibrary } = await import(
  '../../../apps/server/src/service/sync/serializeLibrary'
)
await initializeDatabase()
const full = serializeLibrary('spike-pc', 'Church PC', new Set())
closeDatabase()
rmSync(work, { recursive: true, force: true })

mkdirSync(outDir, { recursive: true })
const sizes = sizeArgs.length ? sizeArgs.map(Number) : [full.songs.length, 3000]
for (const size of sizes) {
  // A deterministic spread over the whole library, not its first N titles.
  const step = full.songs.length / size
  const songs = Array.from(
    { length: Math.min(size, full.songs.length) },
    (_, i) => full.songs[Math.floor(i * step)],
  )
  const kept = new Set(songs.map((song) => song.uuid))
  const library = {
    ...full,
    songs,
    groups: full.groups.filter((group) =>
      songs.some((song) => song.groupUuid === group.uuid),
    ),
    schedules: full.schedules.filter((schedule) =>
      schedule.items.every((item) => !item.songUuid || kept.has(item.songUuid)),
    ),
  }
  const json = JSON.stringify(library)
  const gz = Bun.gzipSync(json, { level: 9 })
  const name = size >= 20000 ? `${Math.round(size / 1000)}k` : String(size)
  await Bun.write(join(outDir, `snapshot-${name}.json.gz`), gz)
  console.log(
    `snapshot-${name}.json.gz: ${songs.length} songs, ${library.categories.length} categories, ${library.schedules.length} schedules, ${(json.length / 1e6).toFixed(2)} MB raw, ${(gz.length / 1e6).toFixed(2)} MB gzipped`,
  )
}
