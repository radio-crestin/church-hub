import type { AccountRecord } from './AccountRecord'

const DAY_MS = 24 * 60 * 60 * 1000

/** The account's backups older than the retention (30 days by default). */
export function expiredBackups(
  record: AccountRecord,
  retentionDays: number,
  now: number
) {
  return record.backups.filter(
    (backup) => now - backup.createdAt >= retentionDays * DAY_MS
  )
}
