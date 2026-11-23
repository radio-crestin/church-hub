/**
 * The spike's bench: the server's service layer on sqlite-wasm + OPFS in this
 * worker. Every call below is the server's own function, unchanged; only the
 * connection (browserConnection.ts) and `bun:sqlite` (bunSqliteShim.ts) are
 * swapped in by the Vite config.
 */
import './processShim'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'

import {
  closeDatabase,
  configurePragmas,
  connectDatabase,
  getRawDatabase,
  initializeDatabase,
} from './browserConnection'
import { configureShim } from './bunSqliteShim'
import {
  clearSearchCache,
  rebuildSearchIndex,
  updateSearchIndex,
} from '../../../../apps/server/src/service/songs/search'
import { searchSongs } from '../../../../apps/server/src/service/songs/song-search/searchSongs'
import {
  getSongsPaginated,
  getSongWithSlides,
  upsertSong,
} from '../../../../apps/server/src/service/songs/songs'
import { adoptRemoteIdentities } from '../../../../apps/server/src/service/sync/adoptRemoteIdentities'
import { applyRemoteChanges } from '../../../../apps/server/src/service/sync/applyRemoteChanges'
import { mergeLibraries } from '../../../../apps/server/src/service/sync/mergeLibraries'
import { serializeLibrary } from '../../../../apps/server/src/service/sync/serializeLibrary'
import { getSyncState } from '../../../../apps/server/src/service/sync/syncStateStore'
import type { LibraryFile } from '../../../../apps/server/src/service/sync/types'

export interface BenchRequest {
  snapshotUrl: string | null
  wipe: boolean
  queries: string[]
  /** Extra pragmas, e.g. "synchronous = OFF", to compare commit costs. */
  pragmas?: string[]
  /** How the first sync writes the db (see firstSyncInto). */
  mode?: 'direct' | 'one-tx' | 'memory-import' | 'memory'
}

export type BenchMessage =
  | { type: 'step'; name: string; ms: number; detail?: unknown }
  | { type: 'done'; results: Record<string, unknown> }
  | {
      type: 'error'
      message: string
      stack?: string
      results: Record<string, unknown>
    }

const POOL_NAME = 'church-hub-spike'

function post(message: BenchMessage): void {
  self.postMessage(message)
}

async function timed<T>(
  results: Record<string, unknown>,
  name: string,
  fn: () => T | Promise<T>,
  detail?: (value: T) => unknown,
): Promise<T> {
  const start = performance.now()
  const value = await fn()
  const ms = Math.round((performance.now() - start) * 10) / 10
  const extra = detail?.(value)
  results[name] = extra === undefined ? ms : { ms, ...(extra as object) }
  post({ type: 'step', name, ms, detail: extra })
  return value
}

function count(table: string): number {
  const row = getRawDatabase()
    .query(`SELECT count(*) AS n FROM ${table}`)
    .get() as { n: number }
  return row.n
}

async function readGzippedJson<T>(response: Response): Promise<T> {
  if (!response.body) throw new Error('empty snapshot body')
  const text = await new Response(
    response.body.pipeThrough(new DecompressionStream('gzip')),
  ).text()
  return JSON.parse(text) as T
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

async function measureSearch(
  queries: string[],
  results: Record<string, unknown>,
) {
  const perQuery: Record<
    string,
    { ms: number; hits: number; top: string | null }
  > = {}
  const all: number[] = []
  for (const query of queries) {
    const runs: number[] = []
    let hits: ReturnType<typeof searchSongs> = []
    for (let i = 0; i < 5; i++) {
      clearSearchCache()
      const start = performance.now()
      hits = searchSongs(query, undefined, 50)
      runs.push(performance.now() - start)
    }
    const ms = Math.round(median(runs) * 10) / 10
    all.push(ms)
    perQuery[query] = { ms, hits: hits.length, top: hits[0]?.title ?? null }
  }
  results.search = { medianMs: median(all), maxMs: Math.max(...all), perQuery }
  post({ type: 'step', name: 'search', ms: median(all), detail: perQuery })
}

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>
type Pool = Awaited<ReturnType<Sqlite3['installOpfsSAHPoolVfs']>>

const DB_FILE = '/church-hub.db'

function useStorage(sqlite3: Sqlite3, pool: Pool, storage: 'memory' | 'opfs') {
  configureShim(
    () =>
      storage === 'memory'
        ? new sqlite3.oo1.DB(':memory:')
        : new pool.OpfsSAHPoolDb(DB_FILE),
    (db) =>
      Number(sqlite3.capi.sqlite3_last_insert_rowid(db.pointer as number)),
  )
}

async function downloadSnapshot(
  url: string,
  results: Record<string, unknown>,
): Promise<LibraryFile> {
  const bytes = await timed(
    results,
    'download',
    async () => {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`snapshot ${res.status}`)
      return res.arrayBuffer()
    },
    (body) => ({ gzBytes: body.byteLength }),
  )
  return timed(
    results,
    'gunzipParse',
    () => readGzippedJson<LibraryFile>(new Response(bytes)),
    (lib) => ({ songs: lib.songs.length, categories: lib.categories.length }),
  )
}

/**
 * The first sync of a new device, in one of four ways:
 * - `direct`: the server's code unchanged, straight on OPFS;
 * - `one-tx`: the same, wrapped in one outer transaction (applyRemoteChanges
 *   refreshes the FTS row of each song in its own autocommit otherwise);
 * - `memory-import` (default): the same code on an in-memory db, then the file
 *   written to OPFS in one go (`importDb`), then reopened from OPFS;
 * - `memory`: in memory only, the baseline without OPFS.
 */
async function firstSyncInto(
  mode: NonNullable<BenchRequest['mode']>,
  sqlite3: Sqlite3,
  pool: Pool,
  snapshotUrl: string,
  results: Record<string, unknown>,
): Promise<void> {
  const inMemory = mode === 'memory' || mode === 'memory-import'
  useStorage(sqlite3, pool, inMemory ? 'memory' : 'opfs')
  await timed(results, 'migrations', () => initializeDatabase())
  const remote = await downloadSnapshot(snapshotUrl, results)
  if (mode === 'one-tx') {
    await timed(results, 'syncApply', () =>
      getRawDatabase().transaction(() => applySnapshot(remote))(),
    )
  } else {
    await timed(
      results,
      'syncApply',
      () => applySnapshot(remote),
      (r) => r,
    )
  }
  await timed(results, 'ftsRebuild', () => rebuildSearchIndex())
  results.songsInDb = count('songs')
  results.slidesInDb = count('song_slides')
  results.wasmHeapBytes = sqlite3.wasm.heap8u().byteLength
  if (mode !== 'memory-import') return

  const bytes = await timed(results, 'exportDb', () =>
    sqlite3.capi.sqlite3_js_db_export(getRawDatabase().wasm.pointer as number),
  )
  closeDatabase()
  await timed(
    results,
    'importDb',
    () => pool.importDb(DB_FILE, bytes),
    () => ({
      bytes: bytes.byteLength,
    }),
  )
  useStorage(sqlite3, pool, 'opfs')
  await timed(results, 'reopen', () => connectDatabase())
}

/** Adopt, merge, apply: the Drive cycle's steps between download and upload. */
function applySnapshot(remote: LibraryFile) {
  const state = getSyncState()
  adoptRemoteIdentities(remote)
  const local = serializeLibrary(state.deviceId, state.deviceName, new Set())
  const now = Math.floor(Date.now() / 1000)
  const { applyOps } = mergeLibraries(local, remote, new Set(), now)
  return applyRemoteChanges(applyOps)
}

async function run(request: BenchRequest): Promise<void> {
  const mode = request.mode ?? 'memory-import'
  const results: Record<string, unknown> = {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
    snapshotUrl: request.snapshotUrl,
    mode: request.snapshotUrl ? mode : 'reopen',
    pragmas: request.pragmas ?? [],
  }
  try {
    const sqlite3 = await timed(results, 'wasmInit', () => sqlite3InitModule())
    results.sqliteVersion = sqlite3.version.libVersion
    const pool = await timed(results, 'opfsInstall', () =>
      sqlite3.installOpfsSAHPoolVfs({ name: POOL_NAME, initialCapacity: 8 }),
    )
    configurePragmas(request.pragmas ?? [])
    if (request.snapshotUrl) {
      await timed(results, 'opfsWipe', () => pool.wipeFiles())
      await firstSyncInto(mode, sqlite3, pool, request.snapshotUrl, results)
    } else {
      // An app start on a device that already synced: open + migrations.
      useStorage(sqlite3, pool, 'opfs')
      await timed(results, 'migrations', () => initializeDatabase())
      results.songsInDb = count('songs')
    }

    await timed(
      results,
      'commitCost',
      () => {
        const db = getRawDatabase()
        db.run('CREATE TABLE IF NOT EXISTS spike_commit (x INTEGER)')
        const start = performance.now()
        for (let i = 0; i < 20; i++) {
          db.query('INSERT INTO spike_commit VALUES (?)').run(i)
        }
        db.run('DROP TABLE spike_commit')
        return (performance.now() - start) / 20
      },
      (perCommit) => ({ msPerAutocommit: Math.round(perCommit * 10) / 10 }),
    )

    await timed(
      results,
      'listFirstPage',
      () => getSongsPaginated(50, 0),
      (page) => ({
        returned: page.songs.length,
        total: page.total,
      }),
    )
    await timed(
      results,
      'listDeepPage',
      () => getSongsPaginated(50, 2000),
      (page) => ({
        returned: page.songs.length,
      }),
    )

    await measureSearch(request.queries, results)

    const first = getSongsPaginated(1, 0).songs[0]
    if (first) {
      const marker = `spikeword${Date.now().toString(36)}`
      await timed(results, 'songEdit', () => {
        const song = getSongWithSlides(first.id)
        if (!song) throw new Error('song vanished')
        return upsertSong({
          id: song.id,
          title: song.title,
          slides: song.slides.map((slide, index) => ({
            id: slide.id,
            content:
              index === 0 ? `${slide.content}\n${marker}` : slide.content,
            sortOrder: slide.sortOrder,
          })),
        })
      })
      // The route refreshes the index after a save; the same call here.
      await timed(results, 'reindexOne', () => updateSearchIndex(first.id))
      clearSearchCache()
      const found = searchSongs(marker)
      results.editFoundBySearch = found.some((hit) => hit.id === first.id)
      results.editQueuedForSync =
        count("sync_pending WHERE entity_type = 'song'") > 0
    }

    const estimate = await navigator.storage.estimate()
    results.storageUsageBytes = estimate.usage ?? null
    results.dbBytes = pool.getFileNames().includes(DB_FILE)
      ? pool.exportFile(DB_FILE).byteLength
      : null
    results.stubCalls = stubCalls()
    closeDatabase()
    post({ type: 'done', results })
  } catch (error) {
    const err = error as Error
    results.stubCalls = stubCalls()
    post({ type: 'error', message: err.message, stack: err.stack, results })
  }
}

function stubCalls(): string[] {
  return [...((globalThis as { __stubCalls?: Set<string> }).__stubCalls ?? [])]
}

self.onmessage = (event: MessageEvent<BenchRequest>) => {
  void run(event.data)
}
