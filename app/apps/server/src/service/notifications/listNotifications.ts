import {
  type AppNotificationRecord,
  NOTIFICATION_RETENTION_MS,
  type NotificationKind,
} from './types'
import { getRawDatabase } from '../../db'

interface NotificationRow {
  id: string
  kind: NotificationKind
  data: string
  created_at: number
  read_at: number | null
}

/** The notifications of the last 60 days, newest first. */
export function listNotifications(now = Date.now()): AppNotificationRecord[] {
  const rows = getRawDatabase()
    .query(
      `SELECT id, kind, data, created_at, read_at FROM notifications
       WHERE created_at >= ? ORDER BY created_at DESC`,
    )
    .all(now - NOTIFICATION_RETENTION_MS) as NotificationRow[]
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    readAt: row.read_at,
  }))
}
