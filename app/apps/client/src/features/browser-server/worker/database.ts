import sqlite3InitModule from '@sqlite.org/sqlite-wasm'

import { configureShim } from './shims/bunSqlite'
import {
  closeDatabase,
  connectDatabase,
  getRawDatabase,
} from './shims/connection'
import { createLogger } from '../../../../../server/src/utils/logger'

const logger = createLogger('browser-server')

type Sqlite3 = Awaited<ReturnType<typeof sqlite3InitModule>>
type Pool = Awaited<ReturnType<Sqlite3['installOpfsSAHPoolVfs']>>

/** sqlite-wasm and this browser's OPFS pool (null: none, memory only). */
export interface Storage {
  sqlite3: Sqlite3
  pool: Pool | null
}

const POOL_NAME = 'church-hub'

/**
 * Loads sqlite-wasm and the OPFS pool its databases live in (the
 * `opfs-sahpool` VFS: no COOP/COEP headers needed). Only one tab can hold
 * the pool; without OPFS (an old or private browser) databases stay in
 * memory for this visit.
 */
export async function openStorage(): Promise<Storage> {
  const sqlite3 = await sqlite3InitModule()
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({
      name: POOL_NAME,
      initialCapacity: 4,
    })
    return { sqlite3, pool }
  } catch (error) {
    logger.warning(`No OPFS, the database stays in memory: ${error}`)
    return { sqlite3, pool: null }
  }
}

export function hasDatabaseFile(storage: Storage, file: string): boolean {
  return storage.pool?.getFileNames().includes(file) ?? false
}

/** Where `bun:sqlite`'s `new Database()` opens from now on (null: memory). */
export function useDatabaseFile(storage: Storage, file: string | null): void {
  const { sqlite3, pool } = storage
  configureShim({
    open: () =>
      file && pool
        ? new pool.OpfsSAHPoolDb(file)
        : new sqlite3.oo1.DB(':memory:'),
    lastInsertRowid: (db) =>
      Number(sqlite3.capi.sqlite3_last_insert_rowid(db.pointer as number)),
    inTransaction: (db) =>
      sqlite3.capi.sqlite3_get_autocommit(db.pointer as number) === 0,
  })
}

/**
 * Writes the database built in memory to its OPFS file in one go and
 * reopens it there: each commit on OPFS costs milliseconds, so a first
 * start (seeding, a first sync) is built in memory (T-170 spike).
 */
export async function saveToFile(
  storage: Storage,
  file: string,
): Promise<void> {
  if (!storage.pool) return
  const bytes = storage.sqlite3.capi.sqlite3_js_db_export(
    getRawDatabase().wasm.pointer as number,
  )
  closeDatabase()
  await storage.pool.importDb(file, bytes)
  useDatabaseFile(storage, file)
  connectDatabase()
}
