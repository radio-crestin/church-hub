import { NOTIFICATION_RETENTION_MS, type NotificationKind } from './types'
import { getRawDatabase } from '../../db'

export function deleteNotification(id: string): boolean {
  const result = getRawDatabase()
    .query('DELETE FROM notifications WHERE id = ?')
    .run(id)
  return result.changes > 0
}

/** Every notification of a kind, but the one with `keepId`. */
export function deleteNotificationsOfKind(
  kind: NotificationKind,
  keepId = '',
): void {
  getRawDatabase()
    .query('DELETE FROM notifications WHERE kind = ? AND id != ?')
    .run(kind, keepId)
}

/** Notifications older than the 60 days they are kept. */
export function deleteOldNotifications(now = Date.now()): number {
  const result = getRawDatabase()
    .query('DELETE FROM notifications WHERE created_at < ?')
    .run(now - NOTIFICATION_RETENTION_MS)
  return result.changes
}

/** Every notification, or all but the song sync's for who can't see songs. */
export function deleteAllNotifications(includeSongs: boolean): number {
  const sql = includeSongs
    ? 'DELETE FROM notifications'
    : "DELETE FROM notifications WHERE kind NOT LIKE 'songs-%'"
  return getRawDatabase().query(sql).run().changes
}
