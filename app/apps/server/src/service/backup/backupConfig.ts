import { eq } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { backupConfig } from '../../db/schema'

export interface BackupConfig {
  autoBackupEnabled: boolean
  intervalHours: number
  /** Number of most-recent backups kept in Drive; older ones are pruned. */
  maxBackups: number
  lastBackupAt: number | null
}

const DEFAULT_CONFIG: BackupConfig = {
  autoBackupEnabled: false,
  intervalHours: 24,
  maxBackups: 5,
  lastBackupAt: null,
}

/**
 * Reads the single-row backup configuration, returning defaults when unset.
 */
export async function getBackupConfig(): Promise<BackupConfig> {
  const db = getDatabase()
  const rows = await db.select().from(backupConfig).limit(1)

  if (rows.length === 0) {
    return { ...DEFAULT_CONFIG }
  }

  const row = rows[0]
  return {
    autoBackupEnabled: row.autoBackupEnabled,
    intervalHours: row.intervalHours,
    maxBackups: row.maxBackups,
    lastBackupAt: row.lastBackupAt ? row.lastBackupAt.getTime() : null,
  }
}

/**
 * Upserts the single-row backup configuration. Only provided fields change.
 */
export async function upsertBackupConfig(
  patch: Partial<BackupConfig>,
): Promise<BackupConfig> {
  const db = getDatabase()
  const rows = await db.select().from(backupConfig).limit(1)

  const lastBackupAt =
    patch.lastBackupAt !== undefined
      ? patch.lastBackupAt === null
        ? null
        : new Date(patch.lastBackupAt)
      : undefined

  if (rows.length === 0) {
    await db.insert(backupConfig).values({
      autoBackupEnabled:
        patch.autoBackupEnabled ?? DEFAULT_CONFIG.autoBackupEnabled,
      intervalHours: patch.intervalHours ?? DEFAULT_CONFIG.intervalHours,
      maxBackups: patch.maxBackups ?? DEFAULT_CONFIG.maxBackups,
      lastBackupAt: lastBackupAt ?? null,
    })
  } else {
    await db
      .update(backupConfig)
      .set({
        ...(patch.autoBackupEnabled !== undefined && {
          autoBackupEnabled: patch.autoBackupEnabled,
        }),
        ...(patch.intervalHours !== undefined && {
          intervalHours: patch.intervalHours,
        }),
        ...(patch.maxBackups !== undefined && {
          maxBackups: patch.maxBackups,
        }),
        ...(lastBackupAt !== undefined && { lastBackupAt }),
        updatedAt: new Date(),
      })
      .where(eq(backupConfig.id, rows[0].id))
  }

  return getBackupConfig()
}
