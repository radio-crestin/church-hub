import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Single-row Google account connection used for Drive backups.
 *
 * Independent from the livestream YouTube connection: it uses its own OAuth
 * client (a "Desktop app" client in the ChurchHub Google Cloud project) and its
 * own local-loopback flow, so backups work without touching the YouTube setup.
 */
export const googleDriveAuth = sqliteTable('google_drive_auth', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  email: text('email'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * Single-row configuration for Google Drive backups. Holds only the
 * automatic-backup preferences and the timestamp of the last successful upload
 * (auth tokens live in `google_drive_auth`).
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
