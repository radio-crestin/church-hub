import type { NotificationInput } from './types'
import { getRawDatabase } from '../../db'

/**
 * Adds a notification, or updates the details of the one with its id; an
 * existing one keeps its date and stays read once read.
 */
export function upsertNotification({ id, kind, data }: NotificationInput) {
  getRawDatabase()
    .query(
      `INSERT INTO notifications (id, kind, data, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, data = excluded.data`,
    )
    .run(id, kind, JSON.stringify(data), Date.now())
}

/** Marks every notification read. */
export function upsertNotificationsRead(): void {
  getRawDatabase()
    .query('UPDATE notifications SET read_at = ? WHERE read_at IS NULL')
    .run(Date.now())
}

/** Marks one notification read; one already gone is left alone. */
export function upsertNotificationRead(id: string): void {
  getRawDatabase()
    .query(
      'UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL',
    )
    .run(Date.now(), id)
}
