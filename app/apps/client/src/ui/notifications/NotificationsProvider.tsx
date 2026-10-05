import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'

import { NotificationHost } from './NotificationHost'
import { NotificationsContext } from './NotificationsContext'
import type {
  Notification,
  NotificationKind,
  NotificationOptions,
  NotificationsApi,
  ToastOptions,
} from './types'

const DEFAULT_DURATION_MS = 4000
const ERROR_DURATION_MS = 6000

function durationOf(notification: Notification) {
  if (notification.duration !== undefined) return notification.duration
  return notification.kind === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS
}

/** Holds the shown notifications and renders them in NotificationHost. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  // A counter, not Date.now(): notifications raised in the same millisecond
  // (one per file of a multi-file upload) must not share an id.
  const nextIdRef = useRef(0)
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const clearTimer = useCallback((id: string) => {
    clearTimeout(timersRef.current.get(id))
    timersRef.current.delete(id)
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id)
      setNotifications((shown) => shown.filter((n) => n.id !== id))
    },
    [clearTimer],
  )

  const notify = useCallback(
    (options: NotificationOptions) => {
      nextIdRef.current += 1
      const notification: Notification = {
        ...options,
        id: options.id ?? `notification-${nextIdRef.current}`,
        kind: options.kind ?? 'info',
      }
      const { id } = notification

      setNotifications((shown) =>
        shown.some((n) => n.id === id)
          ? shown.map((n) => (n.id === id ? notification : n))
          : [...shown, notification],
      )

      clearTimer(id)
      if (!notification.persistent) {
        timersRef.current.set(
          id,
          setTimeout(() => dismiss(id), durationOf(notification)),
        )
      }
      return id
    },
    [clearTimer, dismiss],
  )

  const showToast = useCallback(
    (message: string, kind?: NotificationKind, options?: ToastOptions) =>
      notify({ message, kind, ...options }),
    [notify],
  )

  const api = useMemo<NotificationsApi>(
    () => ({ notify, dismiss, showToast }),
    [notify, dismiss, showToast],
  )

  return (
    <NotificationsContext.Provider value={api}>
      {children}
      <NotificationHost notifications={notifications} onDismiss={dismiss} />
    </NotificationsContext.Provider>
  )
}
