import { fetcher } from '~/utils/fetcher'

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const

/**
 * - songs-synced: the song sync added or updated songs.
 * - songs-pending: songs waiting for the user's approval.
 * - app-update: a new version of the app.
 */
export type NotificationKind = 'songs-synced' | 'songs-pending' | 'app-update'

/** One entry of the notifications history (GET /api/notifications). */
export interface AppNotification {
  id: string
  kind: NotificationKind
  /** Its details; each kind's component knows their shape. */
  data: unknown
  createdAt: number
  readAt: number | null
}

interface ApiResponse<T> {
  data?: T
  error?: string
}

async function call<T>(url: string, method = 'GET', body?: unknown) {
  const response = await fetcher<ApiResponse<T>>(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.error) throw new Error(response.error)
  return response.data as T
}

/** The notifications of the last 60 days, newest first. */
export const listNotifications = () =>
  call<AppNotification[]>('/api/notifications')

export const markNotificationsRead = () =>
  call('/api/notifications/read', 'POST')

export const deleteNotification = (id: string) =>
  call(`/api/notifications/${encodeURIComponent(id)}`, 'DELETE')

/** Puts a new app version in the history (once; again is a no-op). */
export const recordAppUpdate = (version: string) =>
  call('/api/notifications/app-update', 'POST', { version })
