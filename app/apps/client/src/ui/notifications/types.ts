export type NotificationKind = 'info' | 'success' | 'warning' | 'error'

export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface NotificationOptions {
  /** Same id = same notification: a second notify() updates it in place. */
  id?: string
  kind?: NotificationKind
  title?: string
  message: string
  action?: NotificationAction
  /** Stays until dismiss(id); for status banners like "connection lost". */
  persistent?: boolean
  /** Milliseconds before it hides; ignored when persistent. */
  duration?: number
  /** False hides the close button (a banner that only its condition clears). */
  dismissible?: boolean
}

export interface Notification extends NotificationOptions {
  id: string
  kind: NotificationKind
}

export interface ToastOptions {
  duration?: number
  action?: NotificationAction
}

export interface NotificationsApi {
  notify: (options: NotificationOptions) => string
  dismiss: (id: string) => void
  /** Shorthand for a short-lived notification with just a message. */
  showToast: (
    message: string,
    kind?: NotificationKind,
    options?: ToastOptions,
  ) => string
}
