import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'
import { SyncError } from './SyncError'
import type { Bindings } from '../types'

export type SyncDb = ReturnType<typeof drizzle<typeof schema>>

/**
 * The central state: D1 on Cloudflare; self-hosted, a SQLite file behind the
 * same D1 interface (src/selfhost/sqliteAsD1.ts), so one driver serves both.
 */
export function getSyncDb(env: Bindings): SyncDb {
  if (!env.SYNC_DB) {
    throw new SyncError(503, 'not_configured', 'Cloud sync database is not configured')
  }
  return drizzle(env.SYNC_DB, { schema })
}
