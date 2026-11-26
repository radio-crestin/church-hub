import type { BackupEntry } from './AccountRecord'

const DAY_MS = 24 * 60 * 60 * 1000

/** The newest few, then one a day for a week, then one a week for five. */
export const RETENTION = { latest: 3, days: 7, weeks: 5 }

/**
 * Which backups an account keeps: the newest `latest`, the newest of each
 * of the last `days` days and of each of the last `weeks` weeks, at most
 * `maxBackups` in all (newest first). The rest are removed.
 */
export function applyRetention(
  backups: BackupEntry[],
  maxBackups: number,
  now = Date.now()
): { kept: BackupEntry[]; removed: BackupEntry[] } {
  const newestFirst = [...backups].sort((a, b) => b.createdAt - a.createdAt)
  const keep = new Set(newestFirst.slice(0, RETENTION.latest))
  const newestPer = (span: number, count: number) => {
    const seen = new Set<number>()
    for (const backup of newestFirst) {
      const slot = Math.floor((now - backup.createdAt) / span)
      if (slot < count && !seen.has(slot)) {
        seen.add(slot)
        keep.add(backup)
      }
    }
  }
  newestPer(DAY_MS, RETENTION.days)
  newestPer(7 * DAY_MS, RETENTION.weeks)
  const kept = newestFirst.filter((b) => keep.has(b)).slice(0, maxBackups)
  return {
    kept,
    removed: newestFirst.filter((b) => !kept.includes(b)),
  }
}
