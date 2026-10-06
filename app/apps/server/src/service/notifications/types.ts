/**
 * - songs-synced: the song sync added or updated songs.
 * - songs-pending: songs waiting for the user's approval (sync without
 *   approval is off).
 * - app-update: a new version of the app.
 */
export type NotificationKind = 'songs-synced' | 'songs-pending' | 'app-update'

export const NOTIFICATION_KINDS: NotificationKind[] = [
  'songs-synced',
  'songs-pending',
  'app-update',
]

/** One entry of the notifications history. */
export interface AppNotificationRecord {
  id: string
  kind: NotificationKind
  /** The details, worded by the client (songs-synced: a SongSyncData). */
  data: unknown
  createdAt: number
  readAt: number | null
}

export interface NotificationInput {
  id: string
  kind: NotificationKind
  data: unknown
}

/** How long a notification is kept. */
export const NOTIFICATION_RETENTION_MS = 60 * 24 * 60 * 60 * 1000
