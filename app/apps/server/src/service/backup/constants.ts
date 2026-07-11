/** Google Drive's special hidden per-app folder alias. */
export const APP_DATA_FOLDER = 'appDataFolder'

/** MIME type used when uploading the SQLite backup blob. */
export const BACKUP_MIME_TYPE = 'application/x-sqlite3'

export const BACKUP_FILE_PREFIX = 'church-hub-backup'
export const BACKUP_FILE_EXTENSION = '.db'

/** Number of most-recent backups to retain in Drive; older ones are pruned. */
export const MAX_BACKUPS = 10

/**
 * Builds a sortable, human-readable backup filename, e.g.
 * `church-hub-backup-v0.1.80-2026-07-11T09-30-00-000Z.db`.
 */
export function buildBackupFileName(appVersion: string): string {
  const iso = new Date().toISOString().replace(/[:.]/g, '-')
  return `${BACKUP_FILE_PREFIX}-v${appVersion}-${iso}${BACKUP_FILE_EXTENSION}`
}

/** True when a Drive file name belongs to this app's backups. */
export function isBackupFile(name: string | null | undefined): boolean {
  return (
    !!name &&
    name.startsWith(BACKUP_FILE_PREFIX) &&
    name.endsWith(BACKUP_FILE_EXTENSION)
  )
}
