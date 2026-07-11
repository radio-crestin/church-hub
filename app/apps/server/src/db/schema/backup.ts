import { sql } from 'drizzle-orm'
import { integer, sqliteTable } from 'drizzle-orm/sqlite-core'

/**
 * Single-row configuration for Google Drive backups.
 *
 * Auth tokens are NOT stored here — backups reuse the single Google connection
 * from the livestream feature (`youtube_auth`). This table only holds the
 * automatic-backup preferences and the timestamp of the last successful upload.
 */
export const backupConfig = sqliteTable('backup_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  autoBackupEnabled: integer('auto_backup_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  intervalHours: integer('interval_hours').notNull().default(24),
  lastBackupAt: integer('last_backup_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})
