import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { syncConfig } from '../../db/schema'

export interface SyncConfig {
  syncEnabled: boolean
  pollIntervalMinutes: number
  lastSyncAt: number | null
  lastError: string | null
  transport: SyncTransport
}

/** Cloud: the sync service and its bucket (T-171). Drive: the backup option. */
export type SyncTransport = 'drive' | 'cloud'

const DEFAULT_CONFIG: SyncConfig = {
  syncEnabled: false,
  pollIntervalMinutes: 5,
  lastSyncAt: null,
  lastError: null,
  transport: 'drive',
}

/** Reads the single-row sync configuration, returning defaults when unset. */
export async function getSyncConfig(): Promise<SyncConfig> {
  const db = getDatabase()
  const [row] = await db.select().from(syncConfig).limit(1)
  if (!row) return { ...DEFAULT_CONFIG }

  return {
    syncEnabled: row.syncEnabled,
    pollIntervalMinutes: row.pollIntervalMinutes,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.getTime() : null,
    lastError: row.lastError,
    transport: row.transport,
  }
}

/** Upserts the single-row sync configuration. Only provided fields change. */
export async function upsertSyncConfig(
  patch: Partial<SyncConfig>,
): Promise<SyncConfig> {
  const db = getDatabase()
  const [current] = await db.select().from(syncConfig).limit(1)

  const lastSyncAt =
    patch.lastSyncAt !== undefined
      ? patch.lastSyncAt === null
        ? null
        : new Date(patch.lastSyncAt)
      : undefined

  if (!current) {
    await db.insert(syncConfig).values({
      syncEnabled: patch.syncEnabled ?? DEFAULT_CONFIG.syncEnabled,
      pollIntervalMinutes:
        patch.pollIntervalMinutes ?? DEFAULT_CONFIG.pollIntervalMinutes,
      lastSyncAt: lastSyncAt ?? null,
      lastError: patch.lastError ?? null,
      transport: patch.transport ?? DEFAULT_CONFIG.transport,
    })
  } else {
    await db
      .update(syncConfig)
      .set({
        ...(patch.syncEnabled !== undefined && {
          syncEnabled: patch.syncEnabled,
        }),
        ...(patch.pollIntervalMinutes !== undefined && {
          pollIntervalMinutes: patch.pollIntervalMinutes,
        }),
        ...(lastSyncAt !== undefined && { lastSyncAt }),
        ...(patch.lastError !== undefined && { lastError: patch.lastError }),
        ...(patch.transport !== undefined && { transport: patch.transport }),
        updatedAt: new Date(),
      })
      .where(eq(syncConfig.id, current.id))
  }

  return getSyncConfig()
}
